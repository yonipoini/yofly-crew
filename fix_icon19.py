from PIL import Image

# Start from the 1.6x scaled image (v7) which has the perfect glow and size
# but has a tiny bit of white in the extreme corners.
img = Image.open('assets/app-icon-square-v7.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# The perfect dark corner color
bg_color = (22, 18, 30, 255)

# ONLY target the actual white/light-gray corner pixels that slipped through.
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Only fill pixels that are brighter than 150 (which is definitely white/gray 
        # from the corner mask, not the dark purple background!)
        if r > 150 and g > 150 and b > 150:
            pixels[x, y] = bg_color

img.save('assets/app-icon-square-v10.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully filled white corners!")
