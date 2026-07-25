from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
pixels = img.load()

# Find the closest white pixel to the center
min_dist_sq = 1000**2
closest_point = (0, 0)

for y in range(512):
    for x in range(512):
        r, g, b, a = pixels[x, y]
        if r > 200 and g > 200 and b > 200:
            dist_sq = (x - 512)**2 + (y - 512)**2
            if dist_sq < min_dist_sq:
                min_dist_sq = dist_sq
                closest_point = (x, y)

print(f"Closest white pixel is at {closest_point}, distance: {min_dist_sq**0.5}")
