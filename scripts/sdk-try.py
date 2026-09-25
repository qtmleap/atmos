"""Send a short fake training run through the Python SDK.

Needs ATMOS_API_URL and ATMOS_TOKEN (see scripts/sdk-local-seed.mjs).
    cd packages/python-sdk && uv run python ../../scripts/sdk-try.py
"""

import logging
import math
import random

import atmos

logging.basicConfig(level=logging.INFO)

with atmos.init(
    project="sdk-try",
    name=f"run-{random.randint(0, 9999):04d}",
    config={"lr": 1e-3, "batch_size": 32},
    flush_interval=1.0,
) as run:
    logging.getLogger().addHandler(run.log_handler())
    print(f"project_id={run.project_id} job_id={run.job_id}")
    for step in range(1, 51):
        loss = math.exp(-step / 15) + random.uniform(0, 0.05)
        run.log({"loss": loss, "acc": 1 - loss / 2}, step=step)
        if step % 10 == 0:
            logging.info("step %d loss %.4f", step, loss)
    run.log_text("done")
