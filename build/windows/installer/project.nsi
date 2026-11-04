Unicode true
!define INFO_COMPANYNAME "rrabmig"
!define PRODUCT_EXECUTABLE "ZapretDesktop.exe"
!define UNINST_KEY_NAME "rrabmig.ZapretDesktop"
!ifndef WAILS_INSTALL_SCOPE
!define WAILS_INSTALL_SCOPE "user"
!endif
!ifndef REQUEST_EXECUTION_LEVEL
!define REQUEST_EXECUTION_LEVEL "user"
!endif
!include "wails_tools.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"

VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIAddVersionKey "CompanyName" "rrabmig"
VIAddVersionKey "FileDescription" "Zapret Desktop Setup"
VIAddVersionKey "ProductName" "Zapret Desktop"
VIAddVersionKey "ProductVersion" "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright" "${INFO_COPYRIGHT}"
ManifestDPIAware true
Name "Zapret Desktop"
OutFile "..\..\bin\ZapretDesktop-Setup-${INFO_PRODUCTVERSION}-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\ZapretDesktop"
InstallDirRegKey HKCU "Software\rrabmig\ZapretDesktop" "InstallDir"
!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
UninstPage custom un.CleanupPage un.CleanupLeave
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Russian"

LangString CloseApp ${LANG_ENGLISH} "Close Zapret Desktop and its upstream tools, then try again."
LangString CloseApp ${LANG_RUSSIAN} "Закройте Zapret Desktop и оригинальные утилиты, затем повторите попытку."
LangString RemoveService ${LANG_ENGLISH} "The ZapretDesktop service is installed. Open Zapret Desktop, stop and remove its service, then run the uninstaller again. No files have been deleted."
LangString RemoveService ${LANG_RUSSIAN} "Установлена служба ZapretDesktop. Откройте Zapret Desktop, остановите и удалите его службу, затем повторите удаление приложения. Файлы не удалены."
LangString StateUnknown ${LANG_ENGLISH} "Unable to check the engine or service state. Uninstallation was cancelled without deleting files."
LangString StateUnknown ${LANG_RUSSIAN} "Не удалось проверить состояние движка или службы. Удаление отменено без удаления файлов."
LangString CleanupTitle ${LANG_ENGLISH} "Saved versions and settings"
LangString CleanupTitle ${LANG_RUSSIAN} "Скачанные версии и настройки"
LangString KeepData ${LANG_ENGLISH} "Your downloads and settings are kept by default. Select only the data you want to delete."
LangString KeepData ${LANG_RUSSIAN} "По умолчанию скачанные версии и настройки сохраняются. Отметьте данные, которые хотите удалить."
LangString DeleteVersions ${LANG_ENGLISH} "Delete downloaded zapret versions"
LangString DeleteVersions ${LANG_RUSSIAN} "Удалить скачанные версии zapret"
LangString DeleteSettings ${LANG_ENGLISH} "Delete settings, user lists and working copies"
LangString DeleteSettings ${LANG_RUSSIAN} "Удалить настройки, пользовательские списки и рабочие копии"
LangString LockedFile ${LANG_ENGLISH} "Application files are in use. Close the application and retry."
LangString LockedFile ${LANG_RUSSIAN} "Файлы приложения используются. Закройте приложение и повторите попытку."

Var VersionsCheckbox
Var SettingsCheckbox
Var DeleteVersions
Var DeleteSettings

# This mutex is also used by core.AcquireLock. Checking does not start the GUI.
!macro CheckClosed
 System::Call 'kernel32::OpenMutexW(i 0x100000, i 0, w "Local\rrabmig.ZapretDesktop") p.r0 ?e'
 Pop $1
 ${If} $0 P<> 0
  System::Call 'kernel32::CloseHandle(p r0)'
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(CloseApp)" /SD IDOK
  SetErrorLevel 1
  Abort
 ${ElseIf} $1 != 2
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(StateUnknown)" /SD IDOK
  SetErrorLevel 1
  Abort
 ${EndIf}
!macroend

Function .onInit
 !insertmacro wails.checkArchitecture
 !insertmacro CheckClosed
FunctionEnd

Function un.onInit
 StrCpy $DeleteVersions 0
 StrCpy $DeleteSettings 0
 !insertmacro CheckClosed
 # Only read SCM state. Never stop/remove someone else's service or execute upstream.
 System::Call 'advapi32::OpenSCManagerW(p 0, p 0, i 1) p.r0'
 ${If} $0 P= 0
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(StateUnknown)" /SD IDOK
  SetErrorLevel 1
  Abort
 ${EndIf}
 System::Call 'advapi32::OpenServiceW(p r0, w "ZapretDesktop", i 4) p.r1 ?e'
 Pop $2
 System::Call 'advapi32::CloseServiceHandle(p r0)'
 ${If} $1 P<> 0
  System::Call 'advapi32::CloseServiceHandle(p r1)'
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(RemoveService)" /SD IDOK
  SetErrorLevel 1
  Abort
 ${ElseIf} $2 != 1060
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(StateUnknown)" /SD IDOK
  SetErrorLevel 1
  Abort
 ${EndIf}
FunctionEnd

Function un.CleanupPage
 !insertmacro MUI_HEADER_TEXT "$(CleanupTitle)" "$(KeepData)"
 nsDialogs::Create 1018
 Pop $0
 ${NSD_CreateCheckbox} 0 10u 100% 20u "$(DeleteVersions)"
 Pop $VersionsCheckbox
 ${NSD_CreateCheckbox} 0 40u 100% 30u "$(DeleteSettings)"
 Pop $SettingsCheckbox
 nsDialogs::Show
FunctionEnd
Function un.CleanupLeave
 ${NSD_GetState} $VersionsCheckbox $DeleteVersions
 ${NSD_GetState} $SettingsCheckbox $DeleteSettings
FunctionEnd

Section "Install"
 !insertmacro wails.setShellContext
 !insertmacro CheckClosed
 !insertmacro wails.webview2runtime
 SetOutPath $INSTDIR
 !insertmacro wails.files
 File "..\..\..\README.md"
 File "..\..\..\LICENSE"
 File "..\..\..\THIRD_PARTY_NOTICES.md"
 SetOutPath "$INSTDIR\docs"
 File /r "..\..\..\docs\*"
 SetOutPath $INSTDIR
 CreateDirectory "$INSTDIR\versions"
 CreateShortcut "$SMPROGRAMS\Zapret Desktop.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
 # Start menu entry is always installed. A desktop shortcut is deliberately optional.
 IfSilent +3
 MessageBox MB_YESNO "Create a desktop shortcut? / Создать ярлык на рабочем столе?" IDNO +2
 CreateShortcut "$DESKTOP\Zapret Desktop.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
 WriteRegStr HKCU "Software\rrabmig\ZapretDesktop" "InstallDir" "$INSTDIR"
 !insertmacro wails.writeUninstaller
SectionEnd

Section "Uninstall"
 !insertmacro wails.setShellContext
 !insertmacro CheckClosed
 ClearErrors
 Delete "$INSTDIR\${PRODUCT_EXECUTABLE}"
 ${If} ${Errors}
  MessageBox MB_OK|MB_ICONEXCLAMATION "$(LockedFile)" /SD IDOK
  SetErrorLevel 1
  Abort
 ${EndIf}
 Delete "$INSTDIR\README.md"
 Delete "$INSTDIR\LICENSE"
 Delete "$INSTDIR\THIRD_PARTY_NOTICES.md"
 RMDir /r "$INSTDIR\docs"
 ${If} $DeleteVersions == ${BST_CHECKED}
  RMDir /r "$INSTDIR\versions"
 ${EndIf}
 ${If} $DeleteSettings == ${BST_CHECKED}
  RMDir /r "$APPDATA\ZapretDesktop"
 ${EndIf}
 Delete "$SMPROGRAMS\Zapret Desktop.lnk"
 Delete "$DESKTOP\Zapret Desktop.lnk"
 !insertmacro wails.deleteUninstaller
 DeleteRegKey HKCU "Software\rrabmig\ZapretDesktop"
 # Never recursively delete the installation root: downloads survive reinstall.
 RMDir "$INSTDIR"
SectionEnd
