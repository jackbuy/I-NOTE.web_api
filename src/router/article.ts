import Article from '../model/article';
import Support from '../model/support';
import Collect from '../model/collect';
import Follow from '../model/follow';
import Message from '../model/message';
import { SuccessMsg, ErrorMsg } from '../utils/utils';

const setArrVal = (arr1: any, arr2: any, currentUserId: string, type: string) => {
    let arr: any = [];
    arr1.map((item: any) => {
        arr2.map((resp_item: any) => {
            if (item._id == resp_item.articleId && currentUserId == resp_item.createUserId) item[type] = true;
        });
        arr.push(item);
    });
    return arr;
}

/**
 * 查询文章(模糊查询)
 * @param sortType 0(最新)1(最热)
 */
export const articleQuery  = (req: any, res: any) => {
    const { keyword, tagId, publish, userId, currentPage = 1, pageSize = 25, sortType = 'newest' } = req.body;
    let currentUserId: string = ''; // 当前登录用户
    let querySort: any = {};
    let query: any = { publish };
    const querySkip: number = (parseInt(currentPage)-1) * parseInt(pageSize);
    const querylimit: number = parseInt(pageSize);

    if (userId) query.userId = userId;
    if (req.userMsg) currentUserId = req.userMsg.userId;
    if (keyword) {
        const reg = new RegExp(keyword, 'i') //不区分大小写
        query.$or = [ //多条件，数组
            { title: { $regex: reg } },
            { contentText: { $regex: reg } }
        ]
    }
    if (tagId) query.tagId = tagId;
    if (sortType == 'newest') querySort = { _id: -1 }
    if (sortType == 'popular') querySort = { viewCount: -1 }

    const p1 = Article.queryLimit({ query, querylimit, querySkip, querySort});
    const p2 = Article.count(query);
    const p3 = Support.find({ });
    const p4 = Collect.find({ });

    Promise.all([ p1, p2, p3, p4 ]).then((resp) => {
        let result: any[] = [];
        result = setArrVal(resp[0], resp[2], currentUserId, 'isSupport');
        result = setArrVal(resp[0], resp[3], currentUserId, 'isCollect');
        SuccessMsg(res, { data: result, total: resp[1] });
    })
}

// 详情
export const articleDetail  = (req: any, res: any) => {
    const { articleId } = req.body;
    const query: any = { _id: articleId };
    let userId: string = '';
    let result: any = {};
    if (req.userMsg) userId = req.userMsg.userId;

    Article.findOne(query)
        .then((resp: any) => Article.updateOne({ query, update: { viewCount: resp.viewCount + 1 } }))
        .then(() => Article.findOnePopulate(query))
        .then((resp: any) => {
            result = resp;
            return Follow.findOne({ userId, type: 0, followId: resp.userId._id });
        })
        .then((resp: any) => {
            if (resp) result.isFollow = true;
            return Support.findOne({ createUserId: userId, articleId });
        })
        .then((resp: any) => {
            if (resp) result.isSupport = true;
            return Collect.findOne({ createUserId: userId, articleId });
        })
        .then((resp: any) => {
            if (resp) result.isCollect = true;
            SuccessMsg(res, { data: result });
        })
        .catch((err: any) => {
            ErrorMsg(res, { msg: err });
        });
}

// 收藏
export const articleCollect = (req: any, res: any) => {
    const { userId } = req.userMsg;
    const { articleId } = req.params;
    const query: any = { _id: articleId };
    const data: any = {
        articleId,
        createUserId: userId,
        createTime: Date.now()
    };
    let collectCount: number = 0;

    Collect.findOne({ articleId: articleId, createUserId: userId }).then((resp1: any) => {
        if (!resp1) {
            Collect.save(data)
                .then(() => Article.findOne(query))
                .then((resp: any) => {
                    collectCount = resp.collectCount;
                    // 保存消息
                    return Message.save({ articleId, createUserId: userId, receiveUserId: resp.userId, type: 1 });
                })
                .then(() => Article.updateOne({ query, update: { collectCount: collectCount + 1 } })) // 更新文章
                .then(() => { SuccessMsg(res, {}); });
        } else {
            Collect.removeOne({ articleId })
                .then(() => Article.findOne(query))
                .then((resp: any) => {
                    collectCount = resp.collectCount;
                    // 保存消息
                    return Message.save({ articleId, createUserId: userId, receiveUserId: resp.userId, type: 2 });
                })
                .then(() => Article.updateOne({ query, update: { collectCount: collectCount - 1 } })) // 更新文章
                .then(() => { SuccessMsg(res, {}); });
        }
    });
}

// 点赞
export const articleSupport = (req: any, res: any) => {
    const { userId } = req.userMsg;
    const { articleId } = req.params;
    const query: any = { _id: articleId };
    const data: any = {
        articleId,
        createUserId: userId,
        createTime: Date.now()
    };
    let supportCount: number = 0;

    Support.findOne({ articleId: articleId, createUserId: userId }).then((resp1) => {
        if (!resp1) {
            Support.save(data)
                .then(() => Article.findOne(query))
                .then((resp: any) => {
                    supportCount = resp.supportCount;
                    // 保存消息
                    return Message.save({ articleId, createUserId: userId, receiveUserId: resp.userId, type: 5 });
                })
                .then(() => {
                    // 更新文章
                    return Article.updateOne({ query, update: { supportCount: supportCount + 1 } });
                })
                .then(() => { SuccessMsg(res, {}); });
        } else {
            Support.removeOne({ articleId })
                .then(() => Article.findOne(query))
                .then((resp: any) => {
                    supportCount = resp.supportCount;
                    // 保存消息
                    return Message.save({ articleId, createUserId: userId, receiveUserId: resp.userId, type: 6 });
                })
                .then(() => Article.updateOne({ query, update: { supportCount: supportCount - 1 } })) // 更新文章
                .then(() => { SuccessMsg(res, {}); });
        }
    });;
}

// 新增
export const articleAdd  = (req: any, res: any) => {
    const { userId } = req.userMsg;
    const data: any = {
        ...req.body,
        userId,
        createTime: Date.now()
    };
    Article.save(data).then((resp: any) => {
        SuccessMsg(res, { data: { articleId: resp._id } });
    });
}

// 编辑
export const articleEdit  = (req: any, res: any) => {
    const { userId } = req.userMsg;
    const { articleId } = req.params;
    const update: any = {
        ...req.body,
        userId,
        editTime: Date.now()
    };
    const query: any = { _id: articleId };
    Article.updateOne({ query, update })
        .then(() => {
            SuccessMsg(res, {});
        })
        .catch((err: any) => {
            ErrorMsg(res, { msg: err });
        });
}

// 删除
export const articleDelete  = (req: any, res: any) => {
    const { articleId } = req.params;
    const query = { _id: articleId };
    Article.removeOne(query).then((resp: any) => {
        const { deletedCount } = resp;
        if (deletedCount === 1) {
            SuccessMsg(res, {});
        } else {
            ErrorMsg(res, { msg: '文章删除失败！' });
        }
    }).catch(() => {
        ErrorMsg(res, { msg: '文章已不存在！' });
    });
}