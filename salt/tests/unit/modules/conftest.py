import os.path
import sys

# Add our Salt module directory to the python path
sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        ),
        "_modules",
    ),
)
