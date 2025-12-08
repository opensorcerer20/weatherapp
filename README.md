## Weather App (or, Is It Good Weather For Cycling)

I used Github Copilot to code a weather graph using data from [Open-Meteo](https://open-meteo.com/) so I could determine when in the near future I can plan to go cycling.

My conditions are:
- maximum cloud cover: 80%
- maximum wind speed: 17 mph
- maximum precipitation chance: 40%
- minimum temperature: 70 deg F

Open-Meteo requires longitude and latitude, so I included a couple of form fields to change the values as needed. I also included a field for minimum "OK" temperature.

<img width="729" height="201" alt="Screenshot 2025-12-08 at 10 30 07" src="https://github.com/user-attachments/assets/e7e208a1-0bd8-41ee-a129-bdd72b18d5b5" />

I did originally make some weather tiles for each day, but wanted to see the conditions in a graph so I could better gauge conditions.

Here is the graph using sample data to show off what it does in varied situations:

<img width="1288" height="466" alt="Screenshot 2025-12-08 at 10 10 03" src="https://github.com/user-attachments/assets/20cb7271-fded-4fd3-836e-65ee2fa17f53" />

And here is one using current data:

<img width="1245" height="363" alt="Screenshot 2025-12-08 at 10 18 08" src="https://github.com/user-attachments/assets/0c8ad754-52d9-4a68-b64a-8998e03012a3" />


