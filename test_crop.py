from PIL import Image

img = Image.open('assets/logo.png').convert('RGBA')
# Crop a 1024x1024 square from the center horizontally.
# Vertically, let's just try cropping from y=0 to y=1024.
# (768 - 512) = 256
cropped = img.crop((256, 0, 1280, 1024))
cropped.save('assets/logo_cropped.png')
print("Cropped logo.png")
