from PIL import Image

# Open the wide logo image (1536 x 1024)
img = Image.open('assets/logo.png').convert('RGBA')

# Crop the center 1024x1024 square
left = (1536 - 1024) / 2
top = 0
right = left + 1024
bottom = 1024
cropped = img.crop((left, top, right, bottom))

# Erase the text by filling the bottom area with the background color
# The text is at the bottom. We can sample the background color from the very bottom left corner of the cropped image.
pixels = cropped.load()
bg_color = pixels[10, 1010]

# Let's say the text starts around y=650. We'll fill from y=600 to 1024 with bg_color.
for y in range(600, 1024):
    for x in range(1024):
        pixels[x, y] = bg_color

cropped.save('assets/app-icon-square.png')
cropped.save('assets/icon.png')
cropped.save('assets/splash-icon.png')
print("Fixed using cropped logo!")
