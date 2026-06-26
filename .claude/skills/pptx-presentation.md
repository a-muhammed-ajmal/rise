# PPTX Presentation Creation Skill

## Purpose
This skill guides Claude in creating professional PowerPoint presentations using python-pptx. It covers slide design, typography, color theory, and composition principles that make presentations effective.

## Tool
**Library**: `python-pptx`
**Language**: Python 3.7+
**Installation**: `pip install python-pptx`

## Core Principles

### 1. Slide Layout Architecture
- **Title Slide**: Company branding, clear hierarchy (title > subtitle > date)
- **Content Slides**: Consistent margins (0.5" minimum), single dominant visual
- **Bullet Slides**: Max 5 bullets per slide, max 7 words per bullet
- **Comparison Slides**: Side-by-side layout with equal visual weight
- **Closing Slide**: Simple call-to-action or contact information

### 2. Typography System
- **Title Font**: Bold sans-serif (Calibri, Helvetica, or Arial)
- **Body Font**: Readable sans-serif (same family as title)
- **Size Hierarchy**:
  - Title: 44-54pt (bold)
  - Subtitle: 32-40pt
  - Body: 18-24pt
  - Small text: 12-14pt (avoid smaller)
- **Line Spacing**: 1.3-1.5 for readability
- **Avoid**: Serif fonts in body, sizes under 12pt, mixed font families

### 3. Color System
- **Primary Color**: Brand color (single, purpose-driven)
- **Secondary Color**: Accent for emphasis (20% of slides)
- **Neutral Palette**: Black (#1a1a1a), white (#ffffff), grays
- **Text Color**: High contrast (minimum 7:1 on backgrounds)
- **Background**: White or light gray (maximum 5% color saturation)
- **Guidelines**:
  - Use CSS hex format (#2563eb not rgb)
  - Apply consistently across all slides
  - Reserve bright colors for data visualization
  - Avoid more than 4 colors per slide

### 4. Composition & Visual Hierarchy
- **White Space**: Minimum 0.5" margins, breathing room between elements
- **Alignment**: Left-aligned text (Western reading direction), centered for emphasis
- **Visual Weight**: Dominant element gets 60-70% of slide space
- **The Rule of Thirds**: Position key content along imaginary gridlines
- **Consistency**: Same position for titles, same alignment for bullets

### 5. Content Organization
- **One Idea Per Slide**: Single message, supporting details only
- **Progression**: Logical flow from context → problem → solution → action
- **Narrative Arc**:
  1. Opening (establishes context)
  2. Problem (why this matters)
  3. Solution (your approach)
  4. Evidence (data, examples, proof)
  5. Call to Action (what's next)
- **Pacing**: 1-2 minutes per slide when presenting

### 6. Data Visualization
- **Charts**: Simple, high-contrast, labeled clearly
- **Colors**: Use 2-3 colors maximum in charts
- **Labels**: Every axis, legend, and data point labeled
- **Avoid**: 3D effects, decorative elements, unclear units
- **Tables**: Maximum 3 rows x 3 columns (audience can't read more)

## Implementation Patterns

### Pattern 1: Create a Presentation
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

prs = Presentation()
prs.slide_width = Inches(10)
prs.slide_height = Inches(7.5)
```

### Pattern 2: Add a Title Slide
```python
slide = prs.slides.add_slide(prs.slide_layouts[0])
title = slide.shapes.title
subtitle = slide.placeholders[1]

title.text = "Presentation Title"
subtitle.text = "Subtitle or context"

title.text_frame.paragraphs[0].font.size = Pt(54)
title.text_frame.paragraphs[0].font.bold = True
```

### Pattern 3: Add Content with Bullets
```python
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]

title.text = "Key Points"

text_frame = body.text_frame
text_frame.clear()
bullets = [
    "First point",
    "Second point",
    "Third point"
]

for bullet in bullets:
    p = text_frame.add_paragraph()
    p.text = bullet
    p.level = 0
    p.font.size = Pt(24)
```

### Pattern 4: Add Shape and Color
```python
from pptx.enum.shapes import MSO_SHAPE

shape = slide.shapes.add_shape(
    MSO_SHAPE.RECTANGLE,
    Inches(1), Inches(1), Inches(3), Inches(2)
)
shape.fill.solid()
shape.fill.fore_color.rgb = RGBColor(37, 99, 235)  # Brand blue
shape.line.color.rgb = RGBColor(0, 0, 0)
shape.line.width = Pt(2)

text_frame = shape.text_frame
text_frame.text = "Your text here"
```

### Pattern 5: Set Consistent Styling
```python
def style_title(shape, text, size=44):
    text_frame = shape.text_frame
    text_frame.clear()
    p = text_frame.paragraphs[0]
    p.text = text
    p.font.size = Pt(size)
    p.font.bold = True
    p.font.color.rgb = RGBColor(26, 26, 26)  # Dark gray

def style_body(shape, text, size=20):
    text_frame = shape.text_frame
    p = text_frame.paragraphs[0]
    p.text = text
    p.font.size = Pt(size)
    p.font.color.rgb = RGBColor(71, 85, 105)  # Medium gray
```

## Design Checklist

- [ ] Define primary and secondary colors
- [ ] Set consistent title/body font sizes
- [ ] Use minimum 0.5" margins throughout
- [ ] Apply brand colors consistently (not randomly)
- [ ] Ensure all text is 12pt or larger
- [ ] Limit to 1 idea per slide
- [ ] Organize content with clear hierarchy
- [ ] Include white space (don't over-fill)
- [ ] Use left alignment for body text
- [ ] Add speaker notes with timing (1-2 min per slide)

## Anti-Patterns to Avoid

- Mixing serif and sans-serif fonts
- Text smaller than 12pt
- More than 7 colors per presentation
- Overlapping text and images
- Bullet points with more than 7 words
- More than 5 bullet points per slide
- Decorative shapes without purpose
- Inconsistent alignment
- Different title positions across slides
- Over-complex animations

## When to Apply

- Creating business presentations
- Building sales decks
- Designing training materials
- Documenting processes
- Presenting data insights
- Pitching ideas to stakeholders

## Success Metrics

- Can audience read all text from back of room?
- Does each slide have a clear, single message?
- Are colors used consistently and purposefully?
- Does the narrative flow logically?
- Can the presentation be delivered in allocated time?
- Is the design professional and not distracting?
- Are all elements (text, images, shapes) aligned?

## Python-PPTX Reference

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# Common operations
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[0])  # Title layout
shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(1), Inches(3), Inches(2))
shape.fill.solid()
shape.fill.fore_color.rgb = RGBColor(37, 99, 235)
text_frame = shape.text_frame
text_frame.text = "Text"
prs.save('presentation.pptx')
```

## References

- https://python-pptx.readthedocs.io/
- https://www.nngroup.com/articles/presenting-research-findings/
- https://www.garr.com/en/
- https://www.presentation-guru.com/
