import os
import random
import numpy as np
import torch
from kapter_ai_worker.logging.logger import get_logger

os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
os.environ["PYTHONHASHSEED"] = "42"

_logger = get_logger("determinism")
_ENFORCED = False

def enforce_determinism(seed: int = 42, strict_cpu: bool = False):
    """
    Enforce global determinism across all libraries to ensure 
    consistent results across multiple runs of the same input.
    """
    global _ENFORCED
    if _ENFORCED:
        return
        
    _logger.info(f"Enforcing global determinism (seed={seed}, strict_cpu={strict_cpu})...")
    
    # 1. Standard Python/OS seeds
    os.environ["PYTHONHASHSEED"] = str(seed)
    
    # 2. CUDA Determinism (Critical for GPU stability)
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
    
    # 3. Library Seeds
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
    
    # 4. CuDNN Determinism
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False
    
    # 5. Thread Limiting (Only if strict_cpu is requested)
    if strict_cpu:
        try:
            torch.set_num_threads(1)
            torch.set_num_interop_threads(1)
            _logger.info("Strict CPU determinism enabled (Performance will be limited).")
        except RuntimeError as e:
            _logger.debug(f"Could not set torch threads: {e}")
    
    # 6. PyTorch Algorithm Determinism
    try:
        torch.use_deterministic_algorithms(True, warn_only=True)
    except Exception as e:
        _logger.warning(f"Failed to enable strict deterministic algorithms: {e}")
        
    _ENFORCED = True
