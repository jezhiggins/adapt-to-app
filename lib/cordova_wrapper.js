"use strict";

exports.create = cordova_create;
exports.android_build = cordova_android_build;
exports.ios_build = cordova_ios_build;

const fs = require("fs-extra");
const path = require("path");

function cordova_create(appDir) {
    if (fs.existsSync(appDir))
	return;

    cordova(appDir, "create", appDir, "org.place.holder", "PlaceHolder");
    const cwd = change_to(appDir);
    cordova(appDir, "plugin add https://github.com/agamemnus/cordova-plugin-xapkreader.git#cordova-6.5.0");
    cordova(appDir, "platform add android");
    if (is_macosx())
	cordova("platform add ios");
    change_to(cwd);
} // cordova_create

function cordova_android_build(appDir) {
    cordova_build(appDir, "android", "-fat");
} // cordova_android_build

function cordova_ios_build(appDir) {
    if (!is_macosx())
	return;
    cordova_build(appDir, "ios");
} // cordova_ios_build

function cordova_build(appDir, platform, modifier) {
    const cwd = change_to(appDir);

    cordova(appDir, "build", platform);

    // find build product
    const suffix = {"android": ".apk", "ios": ".app"}[platform];
    const app = find_app(suffix);
    if (!app) {
	console.log("\n\nCould not find " + platform + " app!\n\n");
	return;
    } // if ...

    modifier = modifier || "";
    const outputName = path.resolve(appDir, "..", path.basename(app, suffix)) + modifier + suffix;
    if (fs.existsSync(outputName))
	fs.unlinkSync(outputName);
    fs.moveSync(app, outputName, true);
    console.log("\n\nBuilt " + path.basename(outputName));

    change_to(cwd);
} // cordova_build

function cordova(appDir, command, ...options) {
    const child_process = require('child_process');
    const prefix = path.resolve(appDir, "..", "node_modules/cordova/bin/");
    const cmd = "cordova " + command + " " + options.join(" ");
    console.log(cmd);
    child_process.execSync(path.join(prefix, cmd), { stdio: 'inherit' })
} // cordova

function find_app(suffix, dir = process.cwd() + "/platforms") {
    for (const name of fs.readdirSync(dir)) {
	const fullName = path.join(dir, name);
	const stat = fs.statSync(fullName);
	if (stat.isFile() && name.endsWith(suffix))
	    return fullName;
	if (stat.isDirectory()) {
	    let app = find_app(suffix, fullName);
	    if (app)
		return app;
	} // if ...
    }
} // find_app

function change_to(dir) {
    const cwd = process.cwd();
    process.chdir(dir);
    return cwd;
} // change_to

function is_macosx() {
    retrun (process.platform === "darwin");
} // is_maxosx