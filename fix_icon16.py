from PIL import Image

# Start from the 1.6x scaled image which has the perfect glow and size
img = Image.open('assets/app-icon-square-v7.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# The perfect dark corner color
bg_color = (22, 18, 30, 255)

# Fill any remaining white/gray pixels in the corners
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Since the corners should be dark purple/black, anything brighter
        # than the dark purple background is definitely a white corner remnant!
        # The dark background is roughly r=22, g=18, b=30.
        # We will aggressively target anything brighter than (50, 50, 50) 
        # that is near the corners (to avoid erasing the center logo glow!)
        
        # Check if we are near the corners (distance from center > 400)
        dist_sq = (x - 512)**2 + (y - 512)**2
        if dist_sq > 400**2:
            if r > 50 or g > 50 or b > 50:
                pixels[x, y] = bg_color

img.save('assets/app-icon-square-v8.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully filled all white corners, creating a perfect full square!")
