#!/usr/bin/env ruby
require 'find'
require 'fileutils'

wordy = true
apkName = "io.cordova.hellocordova"

pwd = ARGV[0]
platformRoot = pwd + "/platforms/android"
assetsRoot = platformRoot + "/assets/www"
buildDir = platformRoot + "/build/obb"
videoSrcDir = buildDir + "/src"

FileUtils.mkdir_p videoSrcDir

puts "Searching #{assetsRoot} for components ..." if wordy
components = Find.find(assetsRoot).select { |path| path =~ /.*components\.json$/ }

components.each do |component|
  shortName = component[assetsRoot.length+1..component.length]
  puts "Checking #{shortName} for video ..." if wordy
  contents = []
  fileFound = false
  File.open(component).each_line do |line|
    if line =~ /.*\"mp4\"\: ?\".*\",$/
      videopath = line.match(/.*\"mp4\"\: ?\"(.*)\",$/)[1]
      puts "  found #{videopath}" if wordy
      if videopath =~ /\:\/\//
        puts "    but that's a reference to an external URI so let's not worry about it" if wordy
      else
        fileFound = true
        puts "    so let's get to work " if wordy
        fullVideoPath = "#{assetsRoot}/#{videopath}"
        destVideoPath = "#{videoSrcDir}/#{videopath}"
        puts "    moving #{fullVideoPath} to #{destVideoPath}" if wordy
        FileUtils.mkdir_p File.dirname(destVideoPath)
        FileUtils.mv fullVideoPath, destVideoPath

        puts "    updating json" if wordy
        line = "\"mp4\": \"content://#{apkName}/#{videopath}\","
      end
    end

    contents.push line
  end
  if fileFound
    puts "    rewriting component.json" if wordy
    File.open("#{component}", "w+").puts(contents)
  end
end

puts "Creating expansion file ..." if wordy
obbFileName = "main.1.#{apkName}.obb"
zipcmd = "cd #{videoSrcDir} && zip -v -dc -r -Z store ../#{obbFileName} ."
puts "  running '#{zipcmd}'" if wordy
`#{zipcmd}`
puts "Expansion file created at #{buildDir}/#{obbFileName}"
