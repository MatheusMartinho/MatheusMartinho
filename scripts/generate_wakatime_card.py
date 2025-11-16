#!/usr/bin/env python3
"""
WakaTime Stats SVG Generator
Generates a custom Matrix-themed SVG card with WakaTime coding stats
"""

import os
import requests
from datetime import datetime, timedelta

# Configurações
WAKATIME_API_KEY = os.environ.get('WAKATIME_API_KEY')
WAKATIME_API_URL = 'https://wakatime.com/api/v1/users/current/stats/last_7_days'

def get_wakatime_stats():
    """Fetch stats from WakaTime API"""
    headers = {
        'Authorization': f'Basic {WAKATIME_API_KEY}'
    }
    
    try:
        response = requests.get(WAKATIME_API_URL, headers=headers)
        response.raise_for_status()
        return response.json()['data']
    except Exception as e:
        print(f"Error fetching WakaTime data: {e}")
        return None

def format_time(seconds):
    """Convert seconds to human readable format"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    
    if hours > 0:
        return f"{hours}.{minutes} hrs"
    else:
        return f"{minutes} mins"

def generate_svg(stats):
    """Generate SVG card with WakaTime stats"""
    
    # Extrai dados
    total_seconds = stats.get('total_seconds', 0)
    total_time = format_time(total_seconds)
    languages = stats.get('languages', [])[:3]  # Top 3 linguagens
    editors = stats.get('editors', [])
    operating_systems = stats.get('operating_systems', [])
    
    # Informações de editor e OS
    top_editor = editors[0]['name'] if editors else 'N/A'
    editor_percent = round(editors[0]['percent']) if editors else 0
    top_os = operating_systems[0]['name'] if operating_systems else 'N/A'
    os_percent = round(operating_systems[0]['percent']) if operating_systems else 0
    
    # Dimensões ajustadas para combinar com o Streak card
    svg = f'''<svg width="495" height="195" viewBox="0 0 495 195" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="495" height="195" fill="#0d1117" rx="10"/>
  <rect x="1" y="1" width="493" height="193" stroke="#00ff00" stroke-width="2" rx="10" fill="none"/>
  
  <!-- Title -->
  <text x="247.5" y="25" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="16" font-weight="bold" fill="#00ff00" text-anchor="middle">
    ⚡ CODING ACTIVITY
  </text>
  
  <!-- Divider -->
  <line x1="20" y1="38" x2="475" y2="38" stroke="#00ff00" stroke-width="1" opacity="0.3"/>
  
  <!-- Total Time & Period -->
  <text x="30" y="60" font-family="'Segoe UI', Ubuntu, monospace" font-size="12" fill="#00ff00" opacity="0.8">
    ⏱️ Total Time:
  </text>
  <text x="465" y="60" font-family="'Segoe UI', Ubuntu, monospace" font-size="13" font-weight="bold" fill="#00ff00" text-anchor="end">
    {total_time}
  </text>
  
  <text x="30" y="80" font-family="'Segoe UI', Ubuntu, monospace" font-size="12" fill="#00ff00" opacity="0.8">
    📅 Period:
  </text>
  <text x="465" y="80" font-family="'Segoe UI', Ubuntu, monospace" font-size="12" fill="#00ff00" text-anchor="end">
    Last 7 Days
  </text>
  
  <!-- Divider -->
  <line x1="20" y1="92" x2="475" y2="92" stroke="#00ff00" stroke-width="1" opacity="0.3"/>
  
  <!-- Languages Title -->
  <text x="30" y="112" font-family="'Segoe UI', Ubuntu, sans-serif" font-size="13" font-weight="bold" fill="#00ff00">
    📊 TOP LANGUAGES
  </text>
'''
    
    # Adiciona as linguagens dinamicamente
    y_position = 132
    for i, lang in enumerate(languages):
        name = lang['name']
        percent = lang['percent']
        bar_width = int((percent / 100) * 280)
        opacity = 1.0 - (i * 0.15)
        
        svg += f'''  
  <!-- {name} -->
  <text x="30" y="{y_position}" font-family="'Segoe UI', Ubuntu, monospace" font-size="11" fill="#00ff00" opacity="{opacity}">
    {name}
  </text>
  <rect x="130" y="{y_position - 10}" width="280" height="14" fill="#1a1a1a" rx="7"/>
  <rect x="130" y="{y_position - 10}" width="{bar_width}" height="14" fill="#00ff00" opacity="{opacity}" rx="7"/>
  <text x="420" y="{y_position}" font-family="'Segoe UI', Ubuntu, monospace" font-size="11" font-weight="bold" fill="#00ff00" text-anchor="end" opacity="{opacity}">
    {percent:.1f}%
  </text>
'''
        y_position += 20
    
    # Divider final e footer
    svg += f'''  
  <!-- Divider -->
  <line x1="20" y1="175" x2="475" y2="175" stroke="#00ff00" stroke-width="1" opacity="0.3"/>
  
  <!-- Editor & OS -->
  <text x="30" y="190" font-family="'Segoe UI', Ubuntu, monospace" font-size="11" fill="#00ff00" opacity="0.8">
    💼 {top_editor} ({editor_percent}%)
  </text>
  <text x="465" y="190" font-family="'Segoe UI', Ubuntu, monospace" font-size="11" fill="#00ff00" text-anchor="end" opacity="0.8">
    🖥️ {top_os} ({os_percent}%)
  </text>
</svg>'''
    
    return svg

def main():
    """Main function"""
    print("🔄 Fetching WakaTime stats...")
    
    stats = get_wakatime_stats()
    
    if not stats:
        print("❌ Failed to fetch WakaTime stats")
        return
    
    print("✅ Stats fetched successfully")
    print(f"📊 Total time: {format_time(stats.get('total_seconds', 0))}")
    
    svg_content = generate_svg(stats)
    
    # Salva o SVG
    with open('wakatime-card.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    
    print("✅ SVG card generated: wakatime-card.svg")

if __name__ == '__main__':
    main()
