@echo off
set source_dir="C:\Users\K12\Downloads"
set target_dir="C:\Users\K12\Downloads\1"

if not exist %target_dir% (
    mkdir %target_dir%
)

for /r %source_dir% %%f in (*.pdf) do (
    copy "%%f" %target_dir%
)

for /r %source_dir% %%f in (*.pptx) do (
    copy "%%f" %target_dir%
)

for /r %source_dir% %%f in (*.ppt) do (
    copy "%%f" %target_dir%
)

for /r %source_dir% %%f in (*.docx) do (
    copy "%%f" %target_dir%
)

