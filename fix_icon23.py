from PIL import Image
import math

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# Fix the baked-in artifact line at the bottom
for y in range(830, 1024):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 40 or g > 40 or b > 40:
            if r < 230 and g < 230 and b < 230:
                pixels[x, y] = (29, 25, 50, 255)

# Seamlessly extend the gradient to the corners
# The color at the edge of the safe zone (r=330) is (29, 25, 50)
edge_color = (29, 25, 50, 255)
# The color we want at the very extreme corners (r=724)
corner_color = (20, 16, 28, 255)

for y in range(height):
    for x in range(width):
        # Calculate distance from the center (512, 512)
        dist = math.hypot(x - 512, y - 512)
        
        # If the pixel is outside the safe zone (r > 330), replace it!
        # This completely overwrites the white corners and anti-aliased grey lines.
        if dist > 330:
            # Interpolate between edge_color and corner_color based on distance
            # The distance ranges from 330 to ~724
            ratio = min((dist - 330) / (724 - 330), 1.0)
            
            r = int(edge_color[0] * (1 - ratio) + corner_color[0] * ratio)
            g = int(edge_color[1] * (1 - ratio) + corner_color[1] * ratio)
            b = int(edge_color[2] * (1 - ratio) + corner_color[2] * ratio)
            
            pixels[x, y] = (r, g, b, 255)

img.save('assets/app-icon-square-v12.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully generated v12 icon with original size and seamless gradient!")
