import re

# Test different regex patterns
sentence = 'select option A, B, or C'

# Try a simpler approach - capture everything after the action word
pattern1 = r'(select|choose|pick)\s+(?:option\s+)?(.+)'
match1 = re.search(pattern1, sentence, re.IGNORECASE)
print('Pattern 1 match:', match1.groups() if match1 else None)

# Try to capture the full option list
pattern2 = r'(select|choose|pick)\s+(?:option\s+)?([A-Za-z0-9]+(?:\s*,\s*[A-Za-z0-9]+)*(?:\s+or\s+[A-Za-z0-9]+)?)'
match2 = re.search(pattern2, sentence, re.IGNORECASE)
print('Pattern 2 match:', match2.groups() if match2 else None)

# Try a different approach - capture everything until end of sentence
pattern3 = r'(select|choose|pick)\s+(?:option\s+)?([^.!?]+)'
match3 = re.search(pattern3, sentence, re.IGNORECASE)
print('Pattern 3 match:', match3.groups() if match3 else None)

