  # Detector precision: FP32 vs FP16 ONNX

How to export the card detector at both precisions and compare them with the Rust
`ultralytics-inference` CLI.

## Export

From `artifacts/yolo/`:

```bash
yolo export model=best.pt format=onnx               # FP32 -> best.onnx
yolo export model=bestq.pt format=onnx quantize=16  # FP16 -> bestq.onnx (bestq.pt = copy of best.pt)
```

`quantize` replaces the deprecated `half` / `int8` flags (ultralytics 8.4.87): `16` = FP16, `8` = INT8.

## Compare

The Rust CLI (ultralytics-inference 0.0.51, needs a Rust toolchain):

```bash
cargo install ultralytics-inference
```

```bash
ultralytics-inference predict --model best.onnx  --source ..\..\data\real
ultralytics-inference predict --model bestq.onnx --source ..\..\data\real
# runtime precision is a separate flag (8, 16, 32, int8, fp16, ...), FP32 by default
ultralytics-inference predict --model best.onnx  --source ..\..\data\real --quantize 16
```

Annotated images land in `runs/detect/predict<N>`; `--save false` skips them, `--conf`
and `--iou` default to 0.25 / 0.7 (`ultralytics-inference predict --help`).

The banner's `FP32` is that `--quantize` runtime flag, not the model file, so it reads
`FP32` for `bestq.onnx` too. Check the weights themselves instead:

```python
import onnx
m = onnx.load("bestq.onnx")
print({onnx.TensorProto.DataType.Name(t.data_type) for t in m.graph.initializer})  # FLOAT16
```

## Results (17 real shots, CPU)

| Model | Size | Weights | Inference | Detections |
| --- | --- | --- | --- | --- |
| `best.onnx` | 12.4 MB | FP32 | 33.7 ms | reference |
| `bestq.onnx` | 6.2 MB | FP16 | 30.0 ms | same counts on every shot |

- **Accuracy**: identical cards / starrows / textstrips counts per shot. Counts do not prove
  identical boxes; run with `save_txt=True` and compare labels by IoU before relying on it.
- **Speed**: no real gain. CPU execution gets nothing from FP16; the gap is single-run noise.
  The only win is half the file size.
- **CPU speed-up** would need INT8 (`quantize=8 data=<dataset yaml>`), which risks the small
  boxes (starrows, textstrips): compare boxes, not counts.

The detector is ~30 ms of the whole pipeline, so FP32 stays the default.
