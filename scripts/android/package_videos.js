"use strict";
const path = require("path");
const fs = require("fs-extra");
const find_file = require("../../lib/find_file");
const xml_config = require("../../lib/xml_config");

module.exports = function(context) {
    const appDir = context.opts.projectRoot;
    const platformRoot = path.join(appDir, "platforms/android");
    const assetsRoot = path.join(platformRoot, "assets/www");
    const buildDir = path.join(platformRoot, "build/obb");
    const videoSrcDir = path.join(buildDir, "src");

    const apkName = grab_apk_name(appDir);

    const deferral = context.requireCordovaModule('q').defer();

    gather_videos(apkName, assetsRoot, videoSrcDir).
	then(() => create_obb(apkName, videoSrcDir, buildDir)).
	then(() => deferral.resolve());

    return deferral.promise;
} // package_up

function gather_videos(apkName, assetsRoot, videoSrcDir) {
    const p = new Promise((resolve, reject) => {
	make_clean_directory(videoSrcDir);

	const [components_json_file, components_json] = read_components_json(assetsRoot);

        search_for_mp4_tags(components_json, apkName, assetsRoot, videoSrcDir).
	    then(() => {
		write_components_json(components_json_file, components_json);
		resolve(0);
	    });
    });
    return p;
} // function ...

function read_components_json(assetsRoot) {
    console.log(`Searching ${assetsRoot} for components.json ...`);
    const components_json_file = find_file.by_name("components.json", assetsRoot);

    console.log(`Checking ${components_json_file} for video ...`);
    const components_json = JSON.parse(fs.readFileSync(components_json_file));

    console.log(`Saving ${components_json_file}`);
    return [components_json_file, components_json];
} // read_components_json

function write_components_json(components_json_file, components_json) {
    fs.writeFileSync(components_json_file, JSON.stringify(components_json));
} // write_components_json

///////////////////////////////
function create_obb(apkName, videoSrcDir, buildDir) {
    const p = new Promise((resolve, reject) => {
	const obbFileName = path.join(buildDir, `main.1.${apkName}.obb`);
	const zipcmd = `cd ${videoSrcDir} && zip -v -dc -r -Z store ${obbFileName} .`;

	const child_process = require("child_process");
	child_process.execSync(zipcmd, { stdio: "inherit" });

	console.log(`Expansion file create at ${obbFileName}`);

	resolve(0);
    });
    return p;
} // create_obb

function grab_apk_name(appDir) {
    const config_xml = xml_config.read(path.join(appDir, "config.xml"));
    return config_xml.find(".").get("id");
} // grab_apk_name

////////////////////////////////
function search_for_mp4_tags(json, apkName, assetsRoot, videoSrcDir) {
    const found = search_json(json);

    const promises = []
    for(const tag of found) {
	const prom = process_mp4_tag(tag, apkName, assetsRoot, videoSrcDir);
	if (prom)
	    promises.push(prom);
    } // for ...

    return Promise.all(promises);
} // search_for_mp4_tags

function search_json(json, found = []) {
    if (typeof(json) != "object")
	return found;

    for (const key in json)
	if (key === "mp4")
	    found.push(json);
	else
	    search_json(json[key], found);

    return found;
} // search_json

function process_mp4_tag(json, apkName, assetsRoot, videoSrcDir) {
    const videopath = json["mp4"];

    if (videopath.indexOf("://") != -1)
	console.log("    but that's a reference to an external URI so let's not worry about it");
    else if (!videopath && json["source"])
	return download_linked_video(json, apkName, videoSrcDir);
    else
	return move_embedded_mp4(json, apkName, assetsRoot, videoSrcDir);
} // process_mp4_tag

function download_linked_video(json, apkName, videoSrcDir) {
    const p = new Promise((resolve, reject) => {
	const source = json["source"];
	console.log(`Found external video ${json["source"]}`);

	const type = json["type"];
	if ((source.indexOf("player.vimeo") == -1) && (type != "video/vimeo")) {
	    console.log("    but I only know how to download from Vimeo");
	    resolve(0);
	} // if ...

	const videoName = source.substring(source.lastIndexOf("/")+1) + ".mp4";
	const destVideoPath = path.join(videoSrcDir, videoName);
	console.log(`    downloading ${source} to ${destVideoPath} ...`);

	const vidl = require("vimeo-downloader");
	let total = 0;

	const stream = vidl("https://vimeo.com/129196639", { quality: "highest", format: "mp4" });
	stream.pipe(fs.createWriteStream(destVideoPath));

	stream.on('data', (chunk) => {
	    total += chunk.length
	    const kb = Math.floor(total/1024);
	    process.stdout.write(`\r    downloaded ${kb}kB`);
	});

	stream.on('end', () => {
	    console.log("    complete");
	    console.log("    updating json");
	    json["source"] = "";
	    json["type"] = "";
	    json["mp4"] = `content://${apkName}/${videoName}`;
	    resolve(0);
	});
    });
    return p;
} // download_linked_video

//////////////////////////
function move_embedded_mp4(json, apkName, assetsRoot, videoSrcDir) {
    const p = new Promise((resolve, reject) => {
	const videopath = json["mp4"];
	console.log(`Found embedded video ${videopath}`);

	const fullVideoPath = path.join(assetsRoot, videopath);
	const destVideoPath = path.join(videoSrcDir, videopath);
	console.log(`    moving ${fullVideoPath} to ${destVideoPath}`);
	fs.mkdirsSync(path.dirname(destVideoPath));
	fs.moveSync(fullVideoPath, destVideoPath);

	console.log("    updating json");
	json["mp4"] = `content://${apkName}/${videopath}`;
	resolve(0);
    });
    return p;
} // move_embedded_mp4

///////////////////////////////////
function make_clean_directory(dir) {
    if (fs.existsSync(dir))
	clean_directory(dir);
    fs.mkdirsSync(dir);
} // make_or_clean_directory

function clean_directory(dir) {
    for (const name of fs.readdirSync(dir)) {
	const fullName = path.join(dir, name);
	const stat = fs.statSync(fullName);
	if (stat.isFile())
	    fs.unlinkSync(fullName);
	if (stat.isDirectory()) {
	    clean_directory(fullName);
	    fs.rmdirSync(fullName);
	} // if ...
    } // for ...
} // clean_directory
