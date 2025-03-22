@echo off
set "source_dir=C:\Users\K12\Downloads"
set "target_dir=C:\Users\K12\Downloads\1"

if not exist "%target_dir%" mkdir "%target_dir%"


xcopy "%source_dir%\*.pdf" "%target_dir%" /Y /Q
xcopy "%source_dir%\*.pptx" "%target_dir%" /Y /Q
xcopy "%source_dir%\*.ppt" "%target_dir%" /Y /Q
xcopy "%source_dir%\*.docx" "%target_dir%" /Y /Q


for /f "tokens=2 delims==" %%I in ('"wmic os get localdatetime /value"') do set datetime=%%I
set "timestamp=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%"


cd /d "%target_dir%"


git add .
git commit -m "Auto commit - %timestamp%"
git push -u origin main
