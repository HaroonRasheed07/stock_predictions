#!/usr/bin/env python3
"""
FastText Sentiment Analysis Model Training Script

This script trains a fastText model on the Amazon Reviews dataset
for sentiment classification with ~91.6% accuracy.

Dataset: https://www.kaggle.com/datasets/bittlingmayer/amazonreviews
- __label__1: Negative (1-2 star reviews)
- __label__2: Positive (4-5 star reviews)

Usage:
    python3 train_sentiment_model.py --input train.ft.txt --output model_amazon

Requirements:
    pip install fasttext
"""

import argparse
import os
import sys
import fasttext
from pathlib import Path


def train_model(input_file: str, output_path: str, epochs: int = 25, lr: float = 1.0):
    """
    Train fastText supervised model for sentiment classification.
    
    Args:
        input_file: Path to training data in fastText format
        output_path: Path to save trained model (without extension)
        epochs: Number of training epochs (default: 25)
        lr: Learning rate (default: 1.0)
    
    Returns:
        Trained model object
    """
    print(f"📚 Training fastText model on {input_file}...")
    print(f"   Epochs: {epochs}, Learning Rate: {lr}")
    
    try:
        # Train model with optimized parameters
        model = fasttext.train_supervised(
            input=input_file,
            epoch=epochs,
            lr=lr,
            wordNgrams=2,  # Use bigrams for better accuracy
            dim=100,  # Embedding dimension
            minn=3,  # Minimum character n-gram
            maxn=6,  # Maximum character n-gram
            loss='softmax',  # Loss function
            verbose=2
        )
        
        print(f"✅ Model trained successfully!")
        
        # Save model
        model.save_model(f"{output_path}.bin")
        print(f"💾 Model saved to: {output_path}.bin")
        
        # Save quantized model (smaller size for deployment)
        model.quantize(input=input_file, epoch=1, lr=1.0, cutoff=100000)
        model.save_model(f"{output_path}.ftz")
        print(f"💾 Quantized model saved to: {output_path}.ftz")
        
        return model
        
    except Exception as e:
        print(f"❌ Error training model: {e}")
        sys.exit(1)


def test_model(model, test_file: str):
    """
    Test model on test dataset and print metrics.
    
    Args:
        model: Trained fastText model
        test_file: Path to test data in fastText format
    """
    print(f"\n📊 Testing model on {test_file}...")
    
    try:
        # Test model
        N, precision, recall = model.test(test_file)
        
        print(f"✅ Test Results:")
        print(f"   Samples: {N}")
        print(f"   Precision: {precision:.4f} ({precision*100:.2f}%)")
        print(f"   Recall: {recall:.4f} ({recall*100:.2f}%)")
        print(f"   F1-Score: {2 * (precision * recall) / (precision + recall):.4f}")
        
        return {"precision": precision, "recall": recall, "samples": N}
        
    except Exception as e:
        print(f"❌ Error testing model: {e}")
        return None


def predict_sample(model, texts: list):
    """
    Test model predictions on sample texts.
    
    Args:
        model: Trained fastText model
        texts: List of sample texts to classify
    """
    print(f"\n🔮 Sample Predictions:")
    
    for text in texts:
        prediction = model.predict(text)
        label = prediction[0][0]  # __label__1 or __label__2
        confidence = prediction[1][0]
        
        sentiment = "POSITIVE ✅" if label == "__label__2" else "NEGATIVE ❌"
        print(f"   [{sentiment}] ({confidence*100:.1f}%) {text[:60]}...")


def main():
    parser = argparse.ArgumentParser(
        description="Train fastText sentiment analysis model"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to training data (fastText format)"
    )
    parser.add_argument(
        "--output",
        default="models/model_amazon",
        help="Path to save model (default: models/model_amazon)"
    )
    parser.add_argument(
        "--test",
        help="Path to test data for evaluation"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=25,
        help="Number of training epochs (default: 25)"
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=1.0,
        help="Learning rate (default: 1.0)"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not os.path.exists(args.input):
        print(f"❌ Error: Input file not found: {args.input}")
        sys.exit(1)
    
    # Create output directory
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        print(f"📁 Created directory: {output_dir}")
    
    # Train model
    model = train_model(args.input, args.output, args.epochs, args.lr)
    
    # Test model if test file provided
    if args.test:
        if os.path.exists(args.test):
            test_model(model, args.test)
        else:
            print(f"⚠️  Test file not found: {args.test}")
    
    # Sample predictions
    sample_texts = [
        "This product is amazing and works perfectly!",
        "Terrible quality, broke after one week.",
        "It's okay, nothing special but does the job.",
    ]
    predict_sample(model, sample_texts)
    
    print(f"\n✨ Training complete!")
    print(f"📦 Model ready for deployment at: {args.output}.bin")
    print(f"📦 Quantized model ready at: {args.output}.ftz")


if __name__ == "__main__":
    main()
