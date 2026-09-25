"""atmos: wandb代替の軽量な実験管理ツール Python SDK。

```python
import atmos as wb

run = wb.init(project="my-project", name="exp1", config={"lr": 1e-3})
run.log({"loss": 0.1, "acc": 0.95}, step=1)
run.log_image("sample", "path/to/img.png", step=1)
run.log_audio("sample", "path/to/audio.wav", step=1)
run.log_text("epoch 1 done")

import logging
logging.getLogger().addHandler(run.log_handler())

run.finish()
```
"""

from __future__ import annotations

from atmos._run import Run, init

__version__ = "0.1.2"

__all__ = ["Run", "__version__", "init"]
