# TensorFlow and Plotly Warnings - Fix Summary

## Issues Fixed

### 1. **TensorFlow oneDNN Custom Operations Messages**
- **Original**: Info messages about oneDNN custom operations being enabled
- **Solution**: Set `TF_ENABLE_ONEDNN_OPTS=0` environment variable
- **Impact**: Eliminates repetitive performance-related messages

### 2. **TensorFlow CPU Instructions Warnings**
- **Original**: Warnings about AVX2, AVX_VNNI, FMA instructions not being used
- **Solution**: Set `TF_CPP_MIN_LOG_LEVEL=2` to suppress info/warning level logs
- **Impact**: These are just informational and can't be fixed without rebuilding TensorFlow

### 3. **Plotly FutureWarning - DatetimeProperties.to_pydatetime()**
- **Original**: Multiple deprecation warnings from plotly_utils
- **Solution**: Suppressed via `warnings.filterwarnings()` filter
- **Impact**: Plotly library internal issue; needs Plotly update to fully resolve

### 4. **Keras Deprecation - tf.reset_default_graph()**
- **Original**: `The name tf.reset_default_graph is deprecated...`
- **Solution**: Suppressed via `warnings.filterwarnings()` filter
- **Impact**: Keras internal deprecation; will be resolved in future versions

## Implementation Details

### Files Created:
- **`suppress_warnings.py`** - Centralized warning suppression module

### Files Modified:
1. `streamlit_graphs_app.py`
2. `cv360_train.py`
3. `cv360_update_job.py`
4. `cv360_tft_train.py`
5. `cv360_eval_plots.py`

### Change Pattern:
Each file now imports `suppress_warnings` at the very beginning, BEFORE any other imports:
```python
# Suppress TensorFlow and library warnings
import suppress_warnings  # noqa: F401
```

This placement is critical because the suppression must happen before TensorFlow and Plotly modules are imported.

## How It Works

The `suppress_warnings.py` module:
1. Sets TensorFlow environment variables BEFORE module import
2. Registers Python warning filters for known deprecations
3. Sets TensorFlow logging to ERROR level only
4. Prints a confirmation message

## Testing

To verify the fixes work, run any of your main scripts:
```bash
python streamlit_graphs_app.py
# or
python cv360_train.py
# or
streamlit run streamlit_graphs_app.py
```

You should now see a clean "Warnings suppressed - starting application..." message instead of all the warnings.

## Notes

- **Why not disable ALL warnings?** Some warnings are important for catching real issues in development
- **Why this approach?** Instead of modifying individual files to handle each warning, this centralizes all suppression logic
- **Future-proof?** When you upgrade Plotly or TensorFlow, these issues may be resolved; the suppression filters will simply have no effect

## Remaining Messages

The following system-level messages may still appear (these are normal):
- CPU optimization info from TensorFlow (not suppressible easily)
- Hardware-specific messages

These are informational only and don't affect functionality.
