from utils.question_detector import _extract_options_from_match
import re

# Test the extraction with the new pattern
sentence = 'select option A, B, or C'
pattern = r'(select|choose|pick)\s+(?:option\s+)?([^.!?]+)'
match = re.search(pattern, sentence, re.IGNORECASE)
print('Match groups:', match.groups())
options = _extract_options_from_match(match, pattern)
print('Extracted options:', options)

# Test the logic step by step
options_text = 'A, B, or C'
parts = re.split(r'\s*,\s*', options_text)
print('Parts after comma split:', parts)

options = []
for part in parts:
    if ' or ' in part:
        or_parts = re.split(r'\s+or\s+', part)
        options.extend([opt.strip() for opt in or_parts if opt.strip()])
    else:
        options.append(part.strip())

print('Final options:', options)

