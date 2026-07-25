from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

scale = 1.50
new_size = int(1024 * scale)
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)

left = (new_size - 1024) / 2
top = (new_size - 1024) / 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

cropped.save('assets/app-icon-square-v17.png')
print("Saved pure 1.50x scale with no manual replacements")
