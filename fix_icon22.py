from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
pixels = img.load()

# Let's inspect the color at various radii to see if it's already (22, 18, 30)
for r in [200, 250, 300, 320, 330, 340]:
    # Check top edge (x=512, y=512-r)
    color = pixels[512, 512-r]
    print(f"Radius {r}: {color}")

