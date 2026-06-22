import os
import tensorflow as tf
import tf2onnx

# =====================================================================
# 1. Custom Attention Layer Definition
# =====================================================================
@tf.keras.utils.register_keras_serializable()
class SimpleAttention(tf.keras.layers.Layer):
    def __init__(self, **kwargs):
        super(SimpleAttention, self).__init__(**kwargs)

    def call(self, inputs):
        score = tf.nn.softmax(inputs, axis=1)
        context = score * inputs
        return tf.reduce_sum(context, axis=1)

    def get_config(self):
        config = super(SimpleAttention, self).get_config()
        return config

def convert_model():
    model_path = "lstm_attention_final.h5"
    onnx_model_path = "lstm_attention_final.onnx"
    
    if not os.path.exists(model_path):
        print(f"Error: Could not find {model_path}")
        print("Please ensure the H5 model is in the current directory.")
        return

    print(f"Loading Keras model from {model_path}...")
    
    # Load model with custom objects
    model = tf.keras.models.load_model(
        model_path,
        custom_objects={
            "SimpleAttention": SimpleAttention,
            "mse": tf.keras.losses.MeanSquaredError(),
            "mae": tf.keras.metrics.MeanAbsoluteError()
        }
    )
    
    print("Model loaded successfully.")
    print("Converting to ONNX format...")
    
    # Specify the input signature. Our model takes a sequence of shape (None, 60, 1)
    # The batch size can be dynamic, hence None.
    input_signature = [tf.TensorSpec([None, 60, 1], tf.float32, name='input_1')]
    
    # Convert using tf2onnx
    onnx_model, _ = tf2onnx.convert.from_keras(model, input_signature, opset=13)
    
    # Save the ONNX model
    with open(onnx_model_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
        
    print(f"Conversion complete! ONNX model saved to {onnx_model_path}")

if __name__ == "__main__":
    convert_model()
