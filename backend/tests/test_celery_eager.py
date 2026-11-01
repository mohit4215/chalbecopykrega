"""Tests for the single-process Celery behaviour used on Render."""

from app.tasks.celery_worker import (
    EAGER_TASK_STORE,
    EAGER_TASK_STORE_LIMIT,
    record_eager_result,
    report_progress,
)


class _BrokenTask:
    """Stands in for a task whose result backend is unreachable."""

    def update_state(self, **kwargs):
        raise ValueError("task_id must not be empty. Got None instead.")


def test_report_progress_swallows_backend_errors():
    # A failed progress update must never abort a plagiarism scan.
    report_progress(_BrokenTask(), "extracting", 20, "Extracting text...")


def test_report_progress_publishes_state():
    calls = []

    class _RecordingTask:
        def update_state(self, **kwargs):
            calls.append(kwargs)

    report_progress(_RecordingTask(), "scoring", 92, "Scoring matches...")

    assert calls == [
        {
            "state": "PROGRESS",
            "meta": {
                "step": "scoring",
                "progress": 92,
                "message": "Scoring matches...",
            },
        }
    ]


def test_record_eager_result_ignores_missing_task_id():
    before = dict(EAGER_TASK_STORE)
    record_eager_result(None, "SUCCESS", result={"ok": True})
    assert EAGER_TASK_STORE == before


def test_record_eager_result_stores_terminal_state():
    record_eager_result("task-123", "SUCCESS", result={"score": 12.5})
    assert EAGER_TASK_STORE["task-123"] == {
        "state": "SUCCESS",
        "result": {"score": 12.5},
        "error": None,
    }


def test_eager_store_is_bounded():
    for i in range(EAGER_TASK_STORE_LIMIT + 5):
        record_eager_result(f"bounded-{i}", "SUCCESS", result={"i": i})

    assert len(EAGER_TASK_STORE) <= EAGER_TASK_STORE_LIMIT
    assert f"bounded-{EAGER_TASK_STORE_LIMIT + 4}" in EAGER_TASK_STORE
