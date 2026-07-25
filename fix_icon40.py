from PIL import Image

img = Image.open('assets/android-icon-foreground.png')
pixels = img.load()

# Sample the color around the airplane
colors = []
for y in range(400, 450):
    for x in range(400, 450):
        r, g, b, a = pixels[x, y]
        if r < 100 and b > 100: # Find the blue/purple glow
            colors.append((r, g, b))

if colors:
    avg_r = sum(c[0] for c in colors) // len(colors)
    avg_g = sum(c[1] for c in colors) // len(colors)
    avg_b = sum(c[2] for c in colors) // len(colors)
    print(f"Average glow color: ({avg_r}, {avg_g}, {avg_b})")
