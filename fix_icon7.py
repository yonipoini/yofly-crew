from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# Scale the image by 1.6x so the inner squircle is pushed way past the edges
scale = 1.6
new_size = int(1024 * scale)
scaled_img = img.resize((new_size, new_size), Image.Resampling.LANCZOS)

# Crop the center 1024x1024
left = (new_size - 1024) / 2
top = (new_size - 1024) / 2
right = left + 1024
bottom = top + 1024

cropped_img = scaled_img.crop((left, top, right, bottom))

# Just in case any white corners survived the crop, fill them
pixels = cropped_img.load()
for y in range(1024):
    for x in range(1024):
        r, g, b, a = pixels[x, y]
        if r > 240 and g > 240 and b > 240:
            pixels[x, y] = (22, 19, 31, 255)

cropped_img.save('assets/app-icon-square.png')
cropped_img.save('assets/icon.png')
cropped_img.save('assets/splash-icon.png')
print("Successfully generated scaled glowing icon!")
