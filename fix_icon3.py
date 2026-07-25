from PIL import Image
import shutil

# Restore from the untouched foreground icon
shutil.copyfile('assets/android-icon-foreground.png', 'assets/app-icon-square.png')

img = Image.open('assets/app-icon-square.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# The squircle edge colors are very dark purple/black, e.g. (22, 18, 30).
# We will just fill all white pixels with this dark color.
# Apple will apply their own squircle mask over this image anyway, cutting off the corners.
# So the corners just need to be a matching dark color so no white bleeds into the visible area.
fill_color = (22, 18, 30, 255)

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Check if the pixel is part of the white background
        if r > 240 and g > 240 and b > 240:
            pixels[x, y] = fill_color

img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully restored the glowing icon and filled the white corners!")
