from PIL import Image

img = Image.open('assets/logo.png').convert('RGBA')

# Crop a 1024x1024 square from the top center
# The image is 1536 wide, so x starts at (1536 - 1024) / 2 = 256
# We crop from y=0 to y=1024
cropped = img.crop((256, 0, 1280, 1024))
cropped.save('assets/logo_top_crop.png')
print("Cropped top of logo.png")
