from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# Let's search for non-dark pixels at the bottom (y > 900)
print("Looking for artifacts at bottom...")
for y in range(850, 1024):
    for x in range(300, 700):
        r, g, b, a = pixels[x, y]
        if r > 30 or g > 30 or b > 30:
            if r < 230 and g < 230 and b < 230: # ignore the white background
                print(f"Artifact found at x={x}, y={y} with color {r},{g},{b}")
