"""
Suppress TensorFlow and library warnings for cleaner console output.
Call this module at the very beginning of your scripts.
"""

import os
import sys
import warnings

# Set TensorFlow environment variables BEFORE importing tensorflow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TensorFlow logging (0=all, 1=info, 2=warning, 3=error)
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # Disable oneDNN optimization messages

# Suppress specific warnings
warnings.filterwarnings('ignore', category=FutureWarning, module='.*plotly.*')
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', message='.*to_pydatetime.*')
warnings.filterwarnings('ignore', message='.*reset_default_graph.*')

# Filter out common library warnings
import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)

print("Warnings suppressed - starting application...")
