import os
import smtplib
from email.mime.text import MIMEText
import requests
from bs4 import BeautifulSoup

# --- CONFIGURATION ---
# Define the cars you are looking for (Case-insensitive)
TARGET_VEHICLES = [
    {"make": "NISSAN", "model": "300ZX"},
    {"make": "TOYOTA", "model": "4RUNNER"},
    {"make": "INFINITI", "model": "J30"},
    {"make": "TOYOTA", "model": "TACOMA"},
    
]

URL = "https://www.rgpick-a-part.com/inventory.php"

# Fetch credentials from GitHub Secrets
EMAIL_ADDRESS = os.environ.get("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD") # App Password, not normal password
TO_EMAIL = os.environ.get("TO_EMAIL")

def send_alert(matches):
    body = "The following target vehicles were found in the latest inventory update:\n\n"
    for car in matches:
        body += f"🔹 {car['year']} {car['make']} {car['model']} (Row: {car['row']}, Stock: {car['stock']})\n"
    
    msg = MIMEText(body)
    msg['Subject'] = "🚗 RG Pick-A-Part Inventory Alert!"
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = TO_EMAIL

    try:
        # Using Gmail as an example SMTP server
        with smtplib.SMTP_SSL('://gmail.com', 465) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, [TO_EMAIL], msg.as_string())
        print("Alert email sent successfully.")
    except Exception as e:
        print(f"Failed to send email: {e}")

def scrape_inventory():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    response = requests.get(URL, headers=headers)
    
    if response.status_code != 200:
        print(f"Failed to fetch page: HTTP {response.status_code}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Locate the inventory elements
    # Note: If the website structure shifts, tweak this part to match their table headers
    inventory_list = []
    
    # Look for table rows containing car data
    rows = soup.find_all('tr')
    for row in rows:
        cols = [ele.text.strip() for ele in row.find_all('td')]
        if len(cols) >= 5: # Expecting Year, Make, Model, Stock, Row
            inventory_list.append({
                "year": cols[0],
                "make": cols[1].upper(),
                "model": cols[2].upper(),
                "stock": cols[3],
                "row": cols[4]
            })

    # Check for matches
    found_matches = []
    for item in inventory_list:
        for target in TARGET_VEHICLES:
            if target['make'].upper() in item['make'] and target['model'].upper() in item['model']:
                found_matches.append(item)

    if found_matches:
        print(f"Found {len(found_matches)} matching vehicles!")
        send_alert(found_matches)
    else:
        print("No matching vehicles found today.")

if __name__ == "__main__":
    if not all([EMAIL_ADDRESS, EMAIL_PASSWORD, TO_EMAIL]):
        print("Error: Missing email configuration environment variables.")
    else:
        scrape_inventory()
