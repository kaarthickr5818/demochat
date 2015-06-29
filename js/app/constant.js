var SETTINGS = {
    url: "ws://delhi.softwarejoint.com:30000/c2s",
    resend_interval: 30000
};

var QUERY_STATUS = {
    ERROR_NOT_CONNECTED : 0,
    ERROR_NOT_AUTHENTICATED : 1,
    ERROR_INVALID_PARAMS : 2,
    ERROR_FILE_UPLOAD_FAILED : 3,
    ERROR_NO_RESPONSE : 4,
    SEND_TO_SERVER_ALLOWED : 5,
    HAVE_RESPONSE : 6
};

var MSG_TYPES = {
    ACCOUNT_AUTHENTICATE: "acnt/auth",
    ACCOUNT_LOGOUT : "acnt/logout",
    ACCOUNT_PROFILE_SET : "acnt/prof/s",
    ACCOUNT_PROFILE_GET : "acnt/prof/g",
    ACCOUNT_LAST_SEEN : "acnt/prof/ls",
    GET_FRIENDS : "cntct/friends/list",
    BLOCK_USER : "cntct/block",
    UNBLOCK_USER : "cntct/unblock",
    MSG_PRIV : "priv/msg/custom",
    MSG_DATA : "priv/msg/data",
    MSG_DELIVERY_RECIEPT : "priv/msg/dr",
    MSG_READ_RECIEPT : "priv/msg/rr",
    MSG_POKE : "priv/poke",
    LIST_GROUPS : "group/list/all",
    LIST_GROUP_MEMBERS : "group/list/mem",
    CREATE_GROUP : "group/create",
    LEAVE_GROUP : "group/leave",
    ADD_MEMS_TO_GROUP : "group/join",
    MSG_GROUP_DATA : "group/msg/data",
    GET_ARCHIVE : "archive/get",
    STREAM_ACK : "ack",
    AMAZON_S3_GET_UPLOAD : "s3/policy",
    AMAZON_S3_GET_DOWNLOAD : "s3/url",
    ERROR : "err"
};

var MSG_DATA_TYPE = {
    FILE : "f",
    TEXT : "t",
    LOCATION : "l"
};

var SUB_TYPE = {
    TYPING : "t",
    PAUSED: "p",
    STOPPED: "s"
};

var S3_DIR = {
    PROFILE: 1,
    TRANSFER_PHOTO : 2,
    TRANSFER_AUDIO : 3,
    TRANSFER_VIDEO : 4,
    TRANSFER_CUSTOM : 5
};

var MSG_DIRECTION = {
    OUT : 0,
    IN : 1
};

var CODE_MAP = {
    success : 0,
    user_offline_delivered_later : 1,
    user_offline_not_delivered  : 2,
    account_blocked : 51,
    invalid_syntax : 52,
    user_pass_invalid : 53,
    invalid_room_id : 54,
    user_blocked : 55
};

var CONNECTION_STATE = {
    NOT_CONNECTED : 0,
    CONNECTED : 1,
    AUTHENTICATED : 2,
    LOGOUT : 3
};