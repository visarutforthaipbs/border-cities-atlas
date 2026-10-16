"""Headless smoke test: open the atlas, exercise every lens + detail panel,
fail on any console error, and save screenshots to web/../qa/."""
import os, sys, asyncio
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
URL = "file://" + os.path.join(ROOT, "web", "index.html")
OUT = os.path.join(ROOT, "qa")
os.makedirs(OUT, exist_ok=True)


async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", headless=True)
        pg = await b.new_page(viewport={"width": 1512, "height": 920}, device_scale_factor=2)
        pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
        pg.on("pageerror", lambda e: errors.append(str(e)))
        await pg.goto(URL)
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f"{OUT}/1-project.png")
        await pg.click('button[data-lens="trade"]'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{OUT}/2-trade.png")
        await pg.click('li[data-cross="mukdahan"]'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{OUT}/3-crossing.png")
        await pg.click('button[data-lens="knowledge"]'); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path=f"{OUT}/4-knowledge.png")
        await pg.evaluate("location.hash='lens=project&prov=อุบลราชธานี'; location.reload()")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f"{OUT}/5-province.png")
        # full panel scroll capture for province
        panel_h = await pg.evaluate("document.getElementById('panel').scrollHeight")
        print("province panel height", panel_h)
        # pin flow
        await pg.click("#pinMode"); await pg.mouse.click(600, 500); await pg.wait_for_timeout(400)
        await pg.fill('textarea[name="note"]', "ทดสอบหมุด: มีข้อมูลประมงริมโขง"); await pg.fill('input[name="who"]', "ทีมพีไอ")
        await pg.click('button[value="ok"]'); await pg.wait_for_timeout(800)
        n = await pg.evaluate("JSON.parse(localStorage.getItem('bca-workshop-pins-v1')||'[]').length")
        print("pins saved", n)
        await pg.screenshot(path=f"{OUT}/6-pin.png")
        # full-length panel captures (unclip the scroll container)
        async def full_panel(name, hash_):
            await pg.evaluate(f"location.hash='{hash_}'; location.reload()")
            await pg.wait_for_timeout(2200)
            await pg.evaluate("document.querySelector('.layout').style.height='auto';document.getElementById('panel').style.overflow='visible'")
            await pg.locator("#panel").screenshot(path=f"{OUT}/{name}.png")
        await full_panel("7-panel-project", "lens=project")
        await full_panel("8-panel-trade", "lens=trade")
        await full_panel("9-panel-province-tak", "lens=trade&prov=ตาก")
        await full_panel("10-panel-crossing", "cross=chong_chom")
        await b.close()
    print("console errors:", errors or "none")
    sys.exit(1 if errors else 0)

asyncio.run(main())
