import os
from PIL import Image
from rembg import remove, new_session

images_dir = 'images'
print("Initializing u2netp session...")
session = new_session('u2netp')

for fname in sorted(os.listdir(images_dir)):
    if not fname.lower().endswith('.jpg'):
        continue
    
    base_name = os.path.splitext(fname)[0]
    out_path = os.path.join(images_dir, f"{base_name}.png")
    
    in_path = os.path.join(images_dir, fname)
    print(f"Processing {fname} -> {base_name}.png ...")
    try:
        inp = Image.open(in_path)
        output = remove(inp, session=session)
        output.save(out_path, format="PNG")
        print(f"  [OK] Saved: {out_path}")
    except Exception as e:
        print(f"  [ERROR] {fname}: {e}")

print("All character images processed with transparent background!")
