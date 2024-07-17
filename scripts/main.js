import '../stylesheets/main.css'
import Sortable from 'sortablejs';
import {NCRSBanner, NCRSBannerLayer, NCRSBannerPreview} from './components/banner'
import './components/commands'
import { createWithClasses } from './util';

const state = {
  urlCode: "",
  additionalURL: [],
  bannerData: {base: "white", baseCode: "p", patterns: []}
}

const layerPicker = document.getElementById("layer-picker")
const layerList = document.getElementById("layers")
const layerPreview = document.getElementById("preview")

function createLayer(detail) {
  const layer = NCRSBannerLayer.deserialize(detail)
  layer.addEventListener("select-color", updateState)
  layer.addEventListener("select-pattern", updateState)
  layer.addEventListener("update-layer", updateState)
  layer.addEventListener("move-layer", event => { moveLayer(event.detail.layer.id, event.detail.direction) })
  layer.addEventListener("remove-layer", event => {
    const layer = document.getElementById(event.detail.id)
    layer.parentElement.remove()
    updateState()
  })
  return layer
}

function addLayerToList(layer) {
  const li = document.createElement("li")
  li.append(layer)
  layerList.append(li)
}

layerPicker.addEventListener("select-pattern", event => {
  const layer = createLayer(event.detail)
  addLayerToList(layer)
  updateState()
})

const overlayPreview = document.getElementById("preview-overlay")
layerPicker.addEventListener("update-preview", event => {
  if (event.detail) {
    overlayPreview.setAttribute("sprite", event.detail.pattern.sprite)
    overlayPreview.style.setProperty("--ncs-banner-color", event.detail.color.color)
    overlayPreview.style.setProperty("display", "block")
  } else {
    overlayPreview.style.setProperty("display", "none")
  }
})

const basePattern = document.getElementById("base-pattern")
basePattern.addEventListener("select-color", event => {
  state.bannerData.base = event.detail.code
  state.bannerData.baseCode = event.detail.encode
  updateState()
})

function updateState() {
  state.urlCode = state.bannerData.baseCode + "a"
  state.bannerData.patterns = []
  const children = layerList.children
  for (let i = 0; i < children.length; i++) {
    const layer = children[i]
    const bannerLayer = layer.querySelector("ncrs-banner-layer")
    if (bannerLayer.hasAttribute("hidden")) { continue }
    state.urlCode += (bannerLayer.color.encode + bannerLayer.pattern.encode)
    state.bannerData.patterns.push({pattern: bannerLayer.pattern.code, color: bannerLayer.color.code})
  }

  layerPreview.setAttribute("banner", state.urlCode)
  updateURL()
  updateCommand()
}

function updateURL() {
  const current = new URLSearchParams(location)
  const path = "?=" + state.urlCode
  if (current.get("search") == path) { return }
  if (state.bannerData.patterns.length > 0) {
    history.pushState({}, "", path)
  } else {
    history.replaceState({}, "", "/")
  }
  const url = document.getElementById("url")
  url.value = location
}

function updateCommand() {
  document.getElementById("banner-command").setAttribute("banner", state.urlCode)
}

function moveLayer(id, direction) {
  const layer = document.getElementById(id)
  const li = layer.parentElement
  if (direction == -1 && li.previousElementSibling) {
    layerList.insertBefore(li, li.previousElementSibling)
  } else if (direction == 1 && li.nextElementSibling) {
    layerList.insertBefore(li.nextElementSibling, li)
  }
  updateState()
}

function loadFromURL(path) {
  layerList.replaceChildren()
  state.additionalURL = path.replaceAll(/[?=]/g, "").split("_")
  const params = state.additionalURL.shift().match(/.{1,2}/g)
  if (!params) { return }
  layerPreview.setAttribute("banner", params.join(""))
  for (let i = 0; i < params.length; i++) {
    const data = NCRSBanner.fromEncoding(params[i])
    if (i == 0) {
      basePattern.setAttribute("color", data.color.color)
    } else {
      addLayerToList(createLayer(data))
    }
  }
  updateState()
}

function createURLBanner(urlCode) {
  const wrapper = createWithClasses("button", "url-banner")
  const instance = new NCRSBannerPreview
  instance.setAttribute("banner", urlCode)
  wrapper.addEventListener("click", () => {
    loadFromURL(urlCode)
  })

  wrapper.append(instance)
  return wrapper
}

function renderURLBanners(code) {
  const urlBannersContainer = document.getElementById("url-banners-container")
  
  if (code.length < 2) {
    urlBannersContainer.style.setProperty("display", "none")
    return
  }
    
  const urlBanners = document.getElementById("url-banners")

  urlBanners.append(createURLBanner(state.urlCode))
  state.additionalURL.forEach(url => {
    urlBanners.append(createURLBanner(url))
  })
}

function createSavedBanner(urlCode) {
  const instance = createURLBanner(urlCode)
  const deleteButton = createWithClasses("button", "saved-banner-delete")

  deleteButton.addEventListener("click", () => {
    let data = JSON.parse(localStorage.getItem("ncrs-banners-saved"))
    const index = data.indexOf(urlCode)
    data.splice(index, 1)
    localStorage.setItem("ncrs-banners-saved", JSON.stringify(data))
    instance.remove()
    updateSavedBannersURL(data)
  })

  instance.append(deleteButton)
  return instance
}

function renderSavedBanners() {
  const savedBanners = document.getElementById("saved-banners")
  const banners = localStorage.getItem("ncrs-banners-saved")
  const saveButton = document.getElementById("save-button")
  let list

  if (!banners) {
    list = []
    localStorage.setItem("ncrs-banners-saved", JSON.stringify(list))
  } else {
    list = JSON.parse(banners)
  }

  list.forEach(url => {
    savedBanners.prepend(createSavedBanner(url))
  })

  updateSavedBannersURL(list)

  saveButton.addEventListener("click", () => {
    let data = JSON.parse(localStorage.getItem("ncrs-banners-saved"))
    data.push(state.urlCode)
    localStorage.setItem("ncrs-banners-saved", JSON.stringify(data))
    savedBanners.prepend(createSavedBanner(state.urlCode))
    updateSavedBannersURL(data)
  })
}

function updateSavedBannersURL(data) {
  const url = document.getElementById("saved-banners-url")
  if (data.length < 1) {
    url.value = ""
    return
  }
  url.value = location.origin + location.pathname + "?=" + data.join("_")
}

window.addEventListener("load", () => {
  const currentURL = new URLSearchParams(location)
  const code = currentURL.get("search")
  loadFromURL(code)
  renderURLBanners(code)
  renderSavedBanners()
})

new Sortable(layerList, {
  handle: ".layer-handle",
  onEnd: updateState,
})