const periodicRefreshPeriod = 10;
let categories = [];
let selectedCategory = "";
let currentETag = "";
let hold_Periodic_Refresh = false;
let pageManager;
let itemLayout;
let search = "";

let waiting = null;
let waitingGifTrigger = 2000;
function addWaitingGif() {
  clearTimeout(waiting);
  waiting = setTimeout(() => {
    $("#itemsPanel").append(
      $(
        "<div id='waitingGif' class='waitingGifcontainer'><img class='waitingGif' src='Loading_icon.gif' /></div>'"
      )
    );
  }, waitingGifTrigger);
}
function removeWaitingGif() {
  clearTimeout(waiting);
  $("#waitingGif").remove();
}

Init_UI();

async function Init_UI() {
  itemLayout = {
    width: $("#sample").outerWidth(),
    height: $("#sample").outerHeight(),
  };
  pageManager = new PageManager(
    "scrollPanel",
    "itemsPanel",
    itemLayout,
    renderPosts
  );
  compileCategories();
  $("#createPost").on("click", async function () {
    renderCreatePostForm();
  });
  $("#abort").on("click", async function () {
    showPosts();
  });
  $("#aboutCmd").on("click", function () {
    renderAbout();
  });
  $("#searchKey").on("change", () => {
    doSearch();
})
$('#doSearch').on('click', () => {
    doSearch();
})
  showPosts();
  start_Periodic_Refresh();
}
function showPosts() {
  $("#actionTitle").text("Liste des posts");
  $("#scrollPanel").show();
  $("#search").show();
  $("#abort").hide();
  $("#postForm").hide();
  $("#aboutContainer").hide();
  $("#createPost").show();
  hold_Periodic_Refresh = false;
}
function hidePosts() {
  $("#scrollPanel").hide();
  $("#createPost").hide();
  $("#search").show();
  $("#abort").show();
  hold_Periodic_Refresh = true;
}
function start_Periodic_Refresh() {
  setInterval(async () => {
    if (!hold_Periodic_Refresh) {
      let etag = await Posts_API.HEAD();
      if (currentETag != etag) {
        currentETag = etag;
        await pageManager.update(false);
        compileCategories();
      }
    }
  }, periodicRefreshPeriod * 1000);
}
function doSearch() {
  search = $("#searchKey").val().replace(' ', ',');
  pageManager.reset();
}
function renderAbout() {
  $("#scrollPanel").hide();
  $("#abort").show();
  $("#search").hide();
  $("#actionTitle").text("À propos...");
  $("#aboutContainer").show();
}
function updateDropDownMenu() {
  let DDMenu = $("#DDMenu");
  let selectClass = selectedCategory === "" ? "fa-check" : "fa-fw";
  DDMenu.empty();
  DDMenu.append(
    $(`
        <div class="dropdown-item menuItemLayout" id="allCatCmd">
            <i class="menuIcon fa ${selectClass} mx-2"></i> Toutes les catégories
        </div>
        `)
  );
  DDMenu.append($(`<div class="dropdown-divider"></div>`));
  categories.forEach((category) => {
    selectClass = selectedCategory === category ? "fa-check" : "fa-fw";
    DDMenu.append(
      $(`
            <div class="dropdown-item menuItemLayout category" id="allCatCmd">
                <i class="menuIcon fa ${selectClass} mx-2"></i> ${category}
            </div>
        `)
    );
  });
  DDMenu.append($(`<div class="dropdown-divider"></div> `));
  DDMenu.append(
    $(`
        <div class="dropdown-item menuItemLayout" id="aboutCmd">
            <i class="menuIcon fa fa-info-circle mx-2"></i> À propos...
        </div>
        `)
  );
  $("#aboutCmd").on("click", function () {
    renderAbout();
  });
  $("#allCatCmd").on("click", function () {
    showPosts();
    selectedCategory = "";
    updateDropDownMenu();
    pageManager.reset();
  });
  $(".category").on("click", function () {
    showPosts();
    selectedCategory = $(this).text().trim();
    updateDropDownMenu();
    pageManager.reset();
  });
}
async function compileCategories() {
  categories = [];
  let response = await Posts_API.GetQuery("?fields=category&sort=category");
  if (!Posts_API.error) {
    let items = response.data;
    if (items != null) {
      items.forEach((item) => {
        if (!categories.includes(item.Category)) categories.push(item.Category);
      });
      updateDropDownMenu(categories);
    }
  }
}
async function renderPosts(queryString) {
  let endOfData = false;
  queryString += "&sort=Creation,desc";
  if (search != "") queryString += "&keywords=" + search;
  queryString += "&sort=category";
  if (selectedCategory != "") queryString += "&category=" + selectedCategory;
  addWaitingGif();
  let response = await Posts_API.Get(queryString);
  if (!Posts_API.error) {
    currentETag = response.ETag;
    let Posts = response.data;
    if (Posts.length > 0) {

      Posts.forEach((Post) => {
        $("#itemsPanel").append(renderPost(Post));
      });
      $(".editCmd").off();
      $(".editCmd").on("click", function () {
        renderEditPostForm($(this).attr("editPostId"));
      });
      $(".deleteCmd").off();
      $(".deleteCmd").on("click", function () {
        renderDeletePostForm($(this).attr("deletePostId"));
      });
    } else endOfData = true;
  } else {
    renderError(Posts_API.currentHttpError);
  }
  removeWaitingGif();
  setupCallToActionButtons();
  return endOfData;
}

function renderError(message) {
  hidePosts();
  $("#actionTitle").text("Erreur du serveur...");
  $("#errorContainer").show();
  $("#errorContainer").append($(`<div>${message}</div>`));
}
function renderCreatePostForm() {
  renderPostForm();
}
async function renderEditPostForm(id) {
  addWaitingGif();
  let response = await Posts_API.Get(id);
  if (!Posts_API.error) {
    let Post = response.data;
    if (Post !== null) renderPostForm(Post);
    else renderError("Post introuvable!");
  } else {
    renderError(Posts_API.currentHttpError);
  }
  removeWaitingGif();
}
async function renderDeletePostForm(id) {
  hidePosts();
  $("#actionTitle").text("Retrait");
  $("#postForm").show();
  $("#postForm").empty();
  let response = await Posts_API.Get(id);
  if (!Posts_API.error) {
    let Post = response.data;
    if (Post !== null) {
      $("#postForm").append(`
        <div class="PostdeleteForm">
            <h4>Effacer le post suivant?</h4>
            <br>
            <div class="PostRow" id=${Post.Id}">
                <div class="PostContainer noselect">
                    <div class="PostLayout">
                        <div class="Post">
                            <span class="PostTitle">${Post.Title}</span>
                        </div>
                        <span class="PostCategory">${Post.Category}</span>
                    </div>
                    <div class="PostCommandPanel">
                        <span class="editCmd cmdIcon fa fa-pencil" editPostId="${Post.Id}" title="Modifier ${Post.Title}"></span>
                        <span class="deleteCmd cmdIcon fa fa-trash" deletePostId="${Post.Id}" title="Effacer ${Post.Title}"></span>
                    </div>
                </div>
            </div>   
            <br>
            <input type="button" value="Effacer" id="deletePost" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </div>    
        `);
      $("#deletePost").on("click", async function () {
        await Posts_API.Delete(Post.Id);
        if (!Posts_API.error) {
          showPosts();
          await pageManager.update(false);
          compileCategories();
        } else {
          console.log(Posts_API.currentHttpError);
          renderError("Une erreur est survenue!");
        }
      });
      $("#cancel").on("click", function () {
        showPosts();
      });
    } else {
      renderError("Post introuvable!");
    }
  } else renderError(Posts_API.currentHttpError);
}
function getFormData($form) {
  const removeTag = new RegExp("(<[a-zA-Z0-9]+>)|(</[a-zA-Z0-9]+>)", "g");
  var jsonObject = {};
  $.each($form.serializeArray(), (index, control) => {
    jsonObject[control.name] = control.value.replace(removeTag, "");
  });
  return jsonObject;
}
function newPost() {
  Post = {};
  Post.Id = 0;
  Post.Title = "";
  Post.Image = "";
  Post.Category = "";
  Post.Text = "";
  Post.Creation = "";
  return Post;
}
function convertToFrenchDate(numeric_date) {
  date = new Date(numeric_date);
  var options = { year: "numeric", month: "long", day: "numeric" };
  var opt_weekday = { weekday: "long" };
  var weekday = toTitleCase(date.toLocaleDateString("fr-FR", opt_weekday));

  function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }
  return (
    weekday +
    ", " +
    date.toLocaleDateString("fr-FR", options) +
    " - " +
    date.toLocaleTimeString("fr-FR")
  );
}
function renderPostForm(Post = null) {
  hidePosts();
  let create = Post == null;
  let currentDate = Date.now();
  if (create) {
    Post = newPost();
    Post.Image = "images/no-avatar.png";
    Post.Creation = currentDate;
    console.log(Post.Creation);
  }
  $("#actionTitle").text(create ? "Création" : "Modification");
  $("#postForm").show();
  $("#postForm").empty();
  $("#postForm").append(`
        <form class="form" id="PostForm">
            <br>
            <input type="hidden" name="Id" value="${Post.Id}"/>
            <input type="hidden" name="Creation" value="${Post.Creation}"/>
            <label for="Title" class="form-label">Titre </label>
            <input 
                class="form-control"
                name="Title" 
                id="Title" 
                placeholder="Titre"
                required
                RequireMessage="Veuillez entrer un titre"
                InvalidMessage="Le titre comporte un caractère illégal"
                value="${Post.Title}"
            />
           
             <label for="Category" class="form-label">Catégorie </label>
            <input 
                class="form-control"
                name="Category"
                id="Category"
                placeholder="Catégorie"
                required
                value="${Post.Category}"
            />
            
            <label class="form-label">Image </label>
            <div   class='imageUploader' 
                   newImage='${create}' 
                   controlId='Image' 
                   imageSrc='${Post.Image}' 
                   waitingImage="Loading_icon.gif">
            </div>
            <br>
             <label for="Text" class="form-label">Text </label>
             <textarea class="form-control textarea"
                name="Text"
                id="Text"
                placeholder="Text"
                required
                value="${Post.Text}">${Post.Text} </textarea>
                
            <br>
            <input type="submit" value="Enregistrer" id="savePost" class="btn btn-primary">
            <input type="button" value="Annuler" id="cancel" class="btn btn-secondary">
        </form>
    `);
  initImageUploaders();
  initFormValidation();
  $("#PostForm").on("submit", async function (event) {
    event.preventDefault();
    let Post = getFormData($("#PostForm"));
    Post = await Posts_API.Save(Post, create);
    if (!Posts_API.error) {
      showPosts();
      await pageManager.update(false);
      compileCategories();
      pageManager.scrollToElem(Post.Id);
    } else renderError("Une erreur est survenue!");
  });
  $("#cancel").on("click", function () {
    showPosts();
  });
}

//jsp si cest comme cela qui faut faire mais bon. ca marche
//beacoup de essaie erreur ahaha
function setupCallToActionButtons() {
  //check si il overflow
  $.fn.overflown = function () {
    var e = this[0];
    return e.scrollHeight > e.clientHeight || e.scrollWidth > e.clientWidth;
  };

  const descriptions = document.querySelectorAll(".Description");

  descriptions.forEach((desc) => {
    const existingButton = desc.parentElement.querySelector(".toggleButton");
    //sinon il dupliquait a chaque load dun item
    if (existingButton) {
      existingButton.remove();
    }

    if ($(desc).overflown()) {
      //ajouter le boutton si ovrlf
      const toggleButton = document.createElement("button");
      toggleButton.textContent = "Show More";
      toggleButton.classList.add("toggleButton");
//tada
      toggleButton.addEventListener("click", () => {
        if (desc.classList.contains("expanded")) {
          desc.classList.remove("expanded");
          toggleButton.textContent = "Show More";
        } else {
          desc.classList.add("expanded");
          toggleButton.textContent = "Show Less";
        }
      });

      desc.parentElement.appendChild(toggleButton);
    }
  });
}


function renderPost(Post) {
  return $(`
     <div class="PostRow" id='${Post.Id}'>
        <div class="PostContainer noselect">
         <div class="PostLayout">
          <div class="TopPanel">
            <span class="PostCategory">${Post.Category}</span>
            <div class="PostCommandPanel">
                <span class="editCmd cmdIcon fa fa-pencil" editPostId="${Post.Id}" title="Modifier ${Post.Title}"></span>
                <span class="deleteCmd cmdIcon fa fa-trash" deletePostId="${Post.Id}" title="Effacer ${Post.Title}"></span></div>
            </div>
           
            <span class="PostTitle">${Post.Title}</span>
            <div class="PostImgContainer">
            <img class='Image' src='${Post.Image}' />
                <span class='ImgDate'>${convertToFrenchDate(parseInt(Post.Creation))}</span>
            </div>
                <div class="Description" id="desc">  
                ${Post.Text}
                </div>
            </div>
        </div>
    </div>           
    `);
}
