#include <node_api.h>
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>

#include <atomic>
#include <cstring>
#include <string>

namespace {

napi_value MakeBoolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

std::wstring Utf8ToWide(const std::string& value) {
  if (value.empty()) return L"";
  int length = MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), nullptr, 0);
  if (length <= 0) return L"";
  std::wstring wide(length, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.c_str(), static_cast<int>(value.size()), &wide[0], length);
  return wide;
}

std::wstring StringFromNapi(napi_env env, napi_value value) {
  size_t length = 0;
  napi_get_value_string_utf8(env, value, nullptr, 0, &length);
  std::string buffer(length + 1, '\0');
  napi_get_value_string_utf8(env, value, &buffer[0], buffer.size(), &length);
  buffer.resize(length);
  return Utf8ToWide(buffer);
}

class FileDataObject final : public IDataObject {
 public:
  explicit FileDataObject(const std::wstring& file_path) : ref_count_(1), file_path_(file_path) {}

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** object) override {
    if (!object) return E_POINTER;
    if (iid == IID_IUnknown || iid == IID_IDataObject) {
      *object = static_cast<IDataObject*>(this);
      AddRef();
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }

  ULONG STDMETHODCALLTYPE AddRef() override {
    return ++ref_count_;
  }

  ULONG STDMETHODCALLTYPE Release() override {
    ULONG result = --ref_count_;
    if (result == 0) delete this;
    return result;
  }

  HRESULT STDMETHODCALLTYPE GetData(FORMATETC* format, STGMEDIUM* medium) override {
    if (!format || !medium) return E_INVALIDARG;
    if (format->cfFormat != CF_HDROP || !(format->tymed & TYMED_HGLOBAL)) return DV_E_FORMATETC;

    const size_t bytes = sizeof(DROPFILES) + (file_path_.size() + 2) * sizeof(wchar_t);
    HGLOBAL global = GlobalAlloc(GMEM_MOVEABLE | GMEM_ZEROINIT, bytes);
    if (!global) return E_OUTOFMEMORY;

    auto* drop_files = static_cast<DROPFILES*>(GlobalLock(global));
    if (!drop_files) {
      GlobalFree(global);
      return E_OUTOFMEMORY;
    }
    drop_files->pFiles = sizeof(DROPFILES);
    drop_files->fWide = TRUE;
    wchar_t* target = reinterpret_cast<wchar_t*>(reinterpret_cast<BYTE*>(drop_files) + sizeof(DROPFILES));
    memcpy(target, file_path_.c_str(), file_path_.size() * sizeof(wchar_t));
    target[file_path_.size()] = L'\0';
    target[file_path_.size() + 1] = L'\0';
    GlobalUnlock(global);

    medium->tymed = TYMED_HGLOBAL;
    medium->hGlobal = global;
    medium->pUnkForRelease = nullptr;
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GetDataHere(FORMATETC*, STGMEDIUM*) override { return DATA_E_FORMATETC; }
  HRESULT STDMETHODCALLTYPE QueryGetData(FORMATETC* format) override {
    if (!format) return E_INVALIDARG;
    return format->cfFormat == CF_HDROP && (format->tymed & TYMED_HGLOBAL) ? S_OK : DV_E_FORMATETC;
  }
  HRESULT STDMETHODCALLTYPE GetCanonicalFormatEtc(FORMATETC*, FORMATETC* out) override {
    if (out) out->ptd = nullptr;
    return E_NOTIMPL;
  }
  HRESULT STDMETHODCALLTYPE SetData(FORMATETC*, STGMEDIUM*, BOOL) override { return E_NOTIMPL; }
  HRESULT STDMETHODCALLTYPE EnumFormatEtc(DWORD direction, IEnumFORMATETC** enum_format) override {
    if (!enum_format) return E_POINTER;
    *enum_format = nullptr;
    return direction == DATADIR_GET ? OLE_S_USEREG : E_NOTIMPL;
  }
  HRESULT STDMETHODCALLTYPE DAdvise(FORMATETC*, DWORD, IAdviseSink*, DWORD*) override { return OLE_E_ADVISENOTSUPPORTED; }
  HRESULT STDMETHODCALLTYPE DUnadvise(DWORD) override { return OLE_E_ADVISENOTSUPPORTED; }
  HRESULT STDMETHODCALLTYPE EnumDAdvise(IEnumSTATDATA**) override { return OLE_E_ADVISENOTSUPPORTED; }

 private:
  std::atomic<ULONG> ref_count_;
  std::wstring file_path_;
};

class FileDropSource final : public IDropSource {
 public:
  FileDropSource() : ref_count_(1) {}

  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** object) override {
    if (!object) return E_POINTER;
    if (iid == IID_IUnknown || iid == IID_IDropSource) {
      *object = static_cast<IDropSource*>(this);
      AddRef();
      return S_OK;
    }
    *object = nullptr;
    return E_NOINTERFACE;
  }

  ULONG STDMETHODCALLTYPE AddRef() override { return ++ref_count_; }
  ULONG STDMETHODCALLTYPE Release() override {
    ULONG result = --ref_count_;
    if (result == 0) delete this;
    return result;
  }

  HRESULT STDMETHODCALLTYPE QueryContinueDrag(BOOL escape_pressed, DWORD key_state) override {
    if (escape_pressed) return DRAGDROP_S_CANCEL;
    if (!(key_state & MK_LBUTTON)) return DRAGDROP_S_DROP;
    return S_OK;
  }

  HRESULT STDMETHODCALLTYPE GiveFeedback(DWORD) override {
    return DRAGDROP_S_USEDEFAULTCURSORS;
  }

 private:
  std::atomic<ULONG> ref_count_;
};

bool BeginNativeDrag(const std::wstring& file_path) {
  if (file_path.empty()) return false;
  DWORD attributes = GetFileAttributesW(file_path.c_str());
  if (attributes == INVALID_FILE_ATTRIBUTES || (attributes & FILE_ATTRIBUTE_DIRECTORY)) return false;

  HRESULT init = OleInitialize(nullptr);
  const bool should_uninitialize = SUCCEEDED(init);
  if (FAILED(init) && init != RPC_E_CHANGED_MODE) return false;

  auto* data_object = new FileDataObject(file_path);
  auto* drop_source = new FileDropSource();
  DWORD effect = DROPEFFECT_NONE;
  HRESULT result = DoDragDrop(data_object, drop_source, DROPEFFECT_COPY, &effect);
  data_object->Release();
  drop_source->Release();
  if (should_uninitialize) OleUninitialize();
  return result == DRAGDROP_S_DROP || result == S_OK;
}

napi_value StartFileDrag(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  if (argc < 1) return MakeBoolean(env, false);
  std::wstring file_path = StringFromNapi(env, args[0]);
  return MakeBoolean(env, BeginNativeDrag(file_path));
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "startFileDrag", NAPI_AUTO_LENGTH, StartFileDrag, nullptr, &fn);
  napi_set_named_property(env, exports, "startFileDrag", fn);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
