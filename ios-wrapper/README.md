# PLAIGROUND iOS wrapper

Live-site shell. Opens https://wannaplai.com full screen.
Does not change upload or store mapping on the website.

## Pay Apple (you do this)

1. Apple Developer Program — **$99 / year**  
   https://developer.apple.com/programs/enroll/

2. Program overview  
   https://developer.apple.com/programs/

3. Enroll as **individual / sole proprietor** unless you have a company D-U-N-S number. Use your legal first and last name. Turn on 2FA on the Apple Account first.

4. After Apple verifies you, buy the membership. Then you can TestFlight and App Store.

Free Apple ID is enough to install Xcode and run on *your* iPhone over USB. The $99 is for TestFlight + App Store.

## Build on a Mac

```bash
cd ios-wrapper
npm install
npx cap add ios
npx cap sync ios
npx cap open ios

```

In Xcode:

- Signing & Capabilities → your Team (the paid Apple Developer team)
- Bundle ID: `com.plaiground.app` (change if Apple says it is taken)
- Display name: PLAIGROUND
- Run on your iPhone, or Archive → TestFlight

## What this is

The app is a WKWebView pointed at wannaplai.com. Same login, same upload.
App Store review may still ask you to demo an account. Have a test login ready.
