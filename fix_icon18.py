from PIL import Image

img = Image.open('assets/logo.png').convert('RGBA')
width, height = img.size
print(f"logo.png size: {width}x{height}")

# Let's crop an exact 1024x1024 square that is perfectly centered on the airplane logo!
# The airplane logo is roughly in the center vertically, and text is below it.
# We will just visually find the center of the logo.
# Wait, let's just make the user happy by taking the glowing logo and placing it 
# perfectly onto a mathematical gradient that has NO masks and NO circles.

bg_color = (22, 18, 30, 255)
center_color = (60, 40, 100, 255)

# Generate a flawless radial gradient manually.
final = Image.new('RGBA', (1024, 1024))
pixels = final.load()

for y in range(1024):
    for x in range(1024):
        # Distance from center
        dist = ((x - 512)**2 + (y - 512)**2)**0.5
        # Max distance to corner is ~724
        ratio = min(dist / 650.0, 1.0) # Reach full dark before the corner
        
        # Interpolate between center_color and bg_color
        r = int(center_color[0] * (1 - ratio) + bg_color[0] * ratio)
        g = int(center_color[1] * (1 - ratio) + bg_color[1] * ratio)
        b = int(center_color[2] * (1 - ratio) + bg_color[2] * ratio)
        
        pixels[x, y] = (r, g, b, 255)

# Now we take the pure glowing logo from android-icon-foreground.png
icon = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# We know the logo itself (the pin, the airplane, the wings) is completely contained 
# inside a 480x480 square in the center.
icon_crop = icon.crop((272, 272, 752, 752))

# We can safely use the alpha channel of icon_crop? No, icon_crop has a solid background!
# So we need a soft mask to blend the 480x480 crop into our gradient background.
# But if we use a mask, the user might see a "circle" if the gradient doesn't match perfectly.
