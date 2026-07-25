from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# 1. Scale the image by 1.50x. 
# This makes the 687px squircle become 1030px.
# This pushes the left, right, top, and bottom white boundaries OFF the 1024 canvas!
# It makes the 650px wings become 975px, fitting perfectly INSIDE the canvas!
scale = 1.50
new_size = int(1024 * scale) # 1536
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)

# 2. Crop the 1024x1024 center
left = (new_size - 1024) / 2
top = (new_size - 1024) / 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

# 3. Replace the white/grey rounding artifacts in the corners
# Since the squircle is 1030px, the corners of the 1024px canvas WILL hit the white rounding.
# We will aggressively target anything in the extreme corners that isn't perfectly dark.
final_pixels = cropped.load()
bg_color = (22, 18, 30, 255)

for y in range(1024):
    for x in range(1024):
        r, g, b, a = final_pixels[x, y]
        # Only check extreme corners (distance from center > 450)
        dist_sq = (x - 512)**2 + (y - 512)**2
        if dist_sq > 450**2:
            # If it's brighter than the dark purple background, it's part of the rounding artifact!
            # The background here is around (22, 18, 30).
            # We target anything > 35 to safely eliminate the anti-aliased grey lines.
            if r > 35 or g > 35 or b > 35:
                final_pixels[x, y] = bg_color

cropped.save('assets/app-icon-square-v16.png')
cropped.save('assets/app-icon-square.png')
cropped.save('assets/icon.png')
cropped.save('assets/splash-icon.png')
print("Successfully generated v16 with perfect wings and zero corners!")
