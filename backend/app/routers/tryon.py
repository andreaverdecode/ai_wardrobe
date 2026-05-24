import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models.outfit import GenerationJob, JobType, JobStatus, Outfit
from app.schemas.outfit import GenerationJobResponse, GarmentItem, TryonApplyRequest, TryonGenerateModelRequest
from app.services.replicate_service import generate_base_model, apply_virtual_tryon

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tryon", tags=["tryon"])


# ── Background tasks ──────────────────────────────────────────────────────────

async def _bg_generate_model(job_id: str, prompt, gender: str, style: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        _update_job_status(db, job, JobStatus.RUNNING)
        result = await generate_base_model(prompt=prompt, gender=gender, style=style)
        if result.get("status") == JobStatus.FAILED.value:
            _fail_job(db, job, result.get("error", "Errore sconosciuto"))
        else:
            _complete_job(db, job, result)
    except Exception as e:
        logger.exception("Errore background generate-model job=%s", job_id)
        try:
            _fail_job(db, job, str(e))
        except Exception:
            pass
    finally:
        db.close()


async def _bg_apply_tryon(
    job_id: str,
    model_image_url: str,
    garment_items: list[dict],
    outfit_id: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        _update_job_status(db, job, JobStatus.RUNNING)
        result = await apply_virtual_tryon(
            model_image_url=model_image_url,
            garment_items=garment_items,
        )
        if result.get("status") == JobStatus.FAILED.value:
            _fail_job(db, job, result.get("error", "Errore sconosciuto"))
        else:
            _complete_job(db, job, result)
            # Aggiorna outfit.tryon_image_path se fornito
            if outfit_id and result.get("image_path"):
                outfit = db.query(Outfit).filter(Outfit.id == outfit_id).first()
                if outfit:
                    outfit.tryon_image_path = result["image_path"]
                    db.commit()
                    logger.info("outfit %s: tryon_image_path aggiornato → %s", outfit_id, result["image_path"])
    except Exception as e:
        logger.exception("Errore background apply-tryon job=%s", job_id)
        try:
            _fail_job(db, job, str(e))
        except Exception:
            pass
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate-model", response_model=GenerationJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_model_endpoint(
    request: TryonGenerateModelRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = _create_job(
        db=db,
        job_type=JobType.MODEL_GENERATION,
        input_data={"prompt": request.prompt, "gender": request.gender, "style": request.style},
    )
    background_tasks.add_task(_bg_generate_model, job.id, request.prompt, request.gender, request.style)
    return GenerationJobResponse.model_validate(job)


@router.post("/apply", response_model=GenerationJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def apply_tryon_endpoint(
    request: TryonApplyRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    items_data = [{"image_path": g.image_path, "description": g.description} for g in request.garment_items]
    job = _create_job(
        db=db,
        job_type=JobType.TRYON,
        input_data={"model_image_url": request.model_image_url, "garment_items": items_data},
    )
    background_tasks.add_task(_bg_apply_tryon, job.id, request.model_image_url, items_data, request.outfit_id)
    return GenerationJobResponse.model_validate(job)


@router.get("/jobs/{job_id}", response_model=GenerationJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job non trovato")
    return GenerationJobResponse.model_validate(job)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_job(db: Session, job_type: JobType, input_data: dict) -> GenerationJob:
    job = GenerationJob(
        id=str(uuid.uuid4()),
        job_type=job_type,
        status=JobStatus.PENDING,
        input_data=input_data,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _update_job_status(db: Session, job: GenerationJob, new_status: JobStatus) -> None:
    job.status = new_status
    job.updated_at = datetime.utcnow()
    db.commit()


def _complete_job(db: Session, job: GenerationJob, output_data: dict) -> None:
    job.status = JobStatus.COMPLETED
    job.output_data = output_data
    job.updated_at = datetime.utcnow()
    db.commit()


def _fail_job(db: Session, job: GenerationJob, error_message: str) -> None:
    job.status = JobStatus.FAILED
    job.error_message = error_message
    job.updated_at = datetime.utcnow()
    db.commit()
    logger.error("Job %s fallito: %s", job.id, error_message)
