from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

min_x, max_x, min_y, max_y = width, 0, height, 0

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if not (r > 240 and g > 240 and b > 240):
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            if y < min_y: min_y = y
            if y > max_y: max_y = y

print(f"Squircle bounding box: {min_x}, {min_y} to {max_x}, {max_y}")
print(f"Width: {max_x - min_x}, Height: {max_y - min_y}")
