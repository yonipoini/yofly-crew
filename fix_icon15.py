from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# The absolute most foolproof way to eliminate the border lines:
# Scale the image mathematically so that the squircle boundaries 
# are pushed completely off the edge of the 1024x1024 canvas.
scale = 1.6
new_size = int(1024 * scale)
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)

# Crop the perfect 1024x1024 center
left = (new_size - 1024) / 2
top = (new_size - 1024) / 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

cropped.save('assets/app-icon-square-v7.png')
cropped.save('assets/app-icon-square.png')
cropped.save('assets/icon.png')
cropped.save('assets/splash-icon.png')
print("Successfully generated scaled v7 icon without borders!")
