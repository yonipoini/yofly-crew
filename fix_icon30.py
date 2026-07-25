from PIL import Image

img = Image.open('assets/logo.png').convert('RGBA')
pixels = img.load()

empty_start = -1
text_start = -1

for y in range(500, 1024):
    is_empty = True
    for x in range(1536):
        r, g, b, a = pixels[x, y]
        if r > 40 or g > 40 or b > 40:
            is_empty = False
            break
    
    if empty_start == -1 and is_empty:
        empty_start = y
    elif empty_start != -1 and not is_empty and text_start == -1:
        text_start = y
        break

print(f"Empty space starts at y={empty_start}")
print(f"Text starts at y={text_start}")
