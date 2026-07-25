from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# The white corners are basically anything outside the squircle radius.
# We will just detect white/light gray pixels and replace them with bg_color,
# but we will ALSO aggressively clean up the anti-aliased edge to prevent lines.
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        
        # Distance from center
        dist_sq = (x - 512)**2 + (y - 512)**2
        
        # The squircle radius is about 343 from center (dist_sq ~ 117649)
        # Any pixel that is bright and far from center is part of the white corner mask.
        if dist_sq > 300**2:
            if r > 40 or g > 40 or b > 40:
                # We also want to replace the anti-aliased edge, so anything brighter
                # than the dark purple (22, 18, 30) gets forced to dark purple.
                if r < 240 and g < 240 and b < 240:
                    pixels[x, y] = bg_color
                elif r >= 240 and g >= 240 and b >= 240:
                    pixels[x, y] = bg_color

# But wait, this will just create a flat dark purple corner, destroying the smooth gradient!
# The user wants the gradient to continue!
# Actually, the gradient at distance 300 is ALREADY (22, 18, 30)!
# Let's verify this by checking the color at x=512, y=168 (top edge of squircle).
