function buildAddOn(e) {
  if (!e || !e.gmail) {
    return CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle("CommitLens")
          .setSubtitle("Open an email to activate")
      )
      .build();
  }

  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);

  var subject = message.getSubject();
  var body = message.getPlainBody();

  var result = sendToBackend(subject, body);

  return buildCard(result);
}

function sendToBackend(subject, body) {
  var url = "https://YOUR_NGROK_URL/extract";

  var payload = {
    subject: subject,
    body: body
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());

    return result;
  } catch (err) {
    Logger.log(err);
    return null;
  }
}

function buildCard(result) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader().setTitle("CommitLens")
  );

  var section = CardService.newCardSection();

  if (!result) {
    section.addWidget(
      CardService.newTextParagraph()
        .setText("📡 Monitoring this email...")
    );
  } else {
    section.addWidget(
      CardService.newTextParagraph()
        .setText("⚠️ <b>You said:</b><br>" + result.task)
    );

    section.addWidget(
      CardService.newTextParagraph()
        .setText("Status: ⏳ Pending")
    );

    if (result.deadline) {
      var date = new Date(result.deadline);
      section.addWidget(
        CardService.newTextParagraph()
          .setText("⏰ Due: " + date.toLocaleString())
      );
    }
  }

  card.addSection(section);

  return card.build();
}
